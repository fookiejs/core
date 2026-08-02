import { z } from "zod";
import http from "node:http";
import { SpanStatusCode } from "@opentelemetry/api";
import { externalSummaryOf, modelSummaryOf } from "./catalog.ts";
import type { ExternalSummary, ModelSummary } from "./catalog.ts";
import { compensateRun } from "./engine/compensation.ts";
import { executeRun, isFlowOperation, mutationResult, resolveModelByName } from "./engine/flow.ts";
import type { CreateResult, FlowRun, ListResult, MutationResult } from "./engine/flow.ts";
import { uuidV7 } from "./engine/ids.ts";
import {
  emitExternalHandler,
  outboxCompleted,
  outboxFailed,
  outboxPending,
  resolveExternalByName,
  outboxDeadLettered,
  outboxRescheduled,
} from "./engine/outbox.ts";
import type { OutboxEntry } from "./engine/outbox.ts";
import type { RunStateRow } from "./pg/store.ts";
import type { PendingEventQueue, PendingWriteQueue, Runtime } from "./engine/runtime.ts";
import {
  DatabaseError,
  ModelFieldError,
  NotFoundError,
  PgEncodeError,
  ValidationError,
} from "./errors.ts";
import { FailureClass, backoffDelayMs } from "./external.ts";
import type { ExternalDef, ExternalEventOf } from "./external.ts";
import { emptyListPage } from "./filter/ops.ts";
import type { ListPage } from "./filter/ops.ts";
import type { FilterInput } from "./filter/schema.ts";
import { httpErrorPayload, httpStatusForFookieError, listenPort, sendJson } from "./http.ts";
import { routeHttp } from "./http-router.ts";
import { isModelEntity } from "./model.ts";
import type {
  EntityFieldsOf,
  InferCreateBody,
  ModelDef,
  ModelEntity,
  ModelFieldsInput,
  UpdateBody,
} from "./model.ts";
import {
  Observability,
  dispatchIntervalMs,
  snapshotIdleTimeoutMs,
  snapshotStatementTimeoutMs,
  pruneIntervalMs,
  retentionMs,
  runBufferLimit,
} from "./observability.ts";
import type {
  LogEntry,
  LogFieldValue,
  MetricEntry,
  ObsScope,
  ObservabilityPage,
  SpanEntry,
} from "./observability.ts";
import { dbErrorBoxText, dbErrorMessageForLog } from "./pg/encode.ts";
import type { DbErrorBox, PgParam, PgRow } from "./pg/encode.ts";
import { requireInjectedPool, wrapOwnedPool } from "./pg/pool.ts";
import type { InjectablePool } from "./pg/pool.ts";
import { PostgresStore } from "./pg/store.ts";
import type { OutboxQuery, RunQuery } from "./pg/store.ts";
import type { ReadScope } from "./read-scope.ts";
import type { OperationEvent, OperationListener, OperationSubscription } from "./settled.ts";
import { Done, Failed, Phase, Running } from "./signal.ts";
import type { Signal } from "./signal.ts";
import { appendItem, catchValidation, firstPresent, mapLookup } from "./slot.ts";
import { entityRecordFromPlain, entityRecordFromUpdateBody } from "./values.ts";
import type { EntityRecord, JsonValue } from "./values.ts";

export function models(items: readonly ModelDef<ModelFieldsInput>[]): ModelDef<ModelFieldsInput>[] {
  let registered: readonly ModelDef<ModelFieldsInput>[] = [];
  for (const modelDef of items) {
    if (z.string().min(1).safeParse(modelDef.name).success === false) {
      throw ModelFieldError.create("model name required");
    }
    registered = appendItem(registered, modelDef);
  }
  return registered.slice();
}

export type RegisteredModel = ModelDef<ModelFieldsInput>;

export type AppConfig<E extends readonly ExternalDef[] = readonly ExternalDef[]> = {
  listen: string;
  database: string;
  models: readonly RegisteredModel[];
  externals: E;
  onExternalEvent: (event: ExternalEventOf<E[number]>) => Promise<void>;
  pool: readonly InjectablePool[];
};

export class App<E extends readonly ExternalDef[] = readonly ExternalDef[]> {
  private readonly listen: string;
  private readonly registeredModels: readonly RegisteredModel[];
  private readonly externals: E;
  private readonly onExternalEvent: (event: ExternalEventOf<E[number]>) => Promise<void>;
  private readonly pool: InjectablePool;
  private readonly ownsPool: boolean;
  private readonly store: PostgresStore;
  private readonly runs = new Map<string, FlowRun<ModelFieldsInput>>();
  private readonly outbox = new Map<string, OutboxEntry>();
  private readonly entities = new Map<string, EntityRecord>();
  private readonly obs = new Observability();
  private readonly listenerBox: { listeners: readonly OperationListener[] } = {
    listeners: [],
  };
  private readonly pendingExternalEvents: PendingEventQueue = { events: [] };
  private readonly pendingEntityWrites: PendingWriteQueue = { rows: [] };
  private readonly dbReadyBox: { ready: boolean } = { ready: false };
  private readonly dbErrorBox: { messages: readonly string[] } = { messages: [] };
  private readonly serverBox: { servers: readonly http.Server[] } = { servers: [] };
  private readonly dispatcherBox: {
    timers: readonly NodeJS.Timeout[];
    running: boolean;
    prunedAtMs: number;
  } = {
    timers: [],
    running: false,
    prunedAtMs: 0,
  };

  private constructor(config: AppConfig<E>) {
    this.listen = config.listen;
    this.registeredModels = config.models;
    this.externals = config.externals;
    this.onExternalEvent = config.onExternalEvent;
    if (config.pool.length > 0) {
      this.ownsPool = false;
      this.pool = requireInjectedPool(config.pool);
    } else {
      this.ownsPool = true;
      this.pool = wrapOwnedPool(config.database);
    }
    this.store = PostgresStore.create(this.pool, [
      (message) => {
        if (z.string().safeParse(message).success === false) {
          this.dbErrorBox.messages = [];
          return;
        }
        if (message.length < 1) {
          this.dbErrorBox.messages = [];
          return;
        }
        this.dbErrorBox.messages = [message];
      },
    ]);
  }

  static create<const E extends readonly ExternalDef[]>(config: AppConfig<E>): App<E> {
    if (z.string().safeParse(config.listen).success === false) {
      throw ValidationError.create("app listen required");
    }
    if (z.string().safeParse(config.database).success === false) {
      throw ValidationError.create("app database required");
    }
    if (config.models.length < 1) {
      throw ValidationError.create("app models required");
    }
    return new App(config);
  }

  private reportAppError(
    operation: string,
    message: string,
    fields: Record<string, LogFieldValue>,
  ): void {
    const errorId = uuidV7();
    this.obs.error(
      {
        traceId: errorId,
        model: "app",
        entityId: errorId,
        operation,
        parent: [],
      },
      message,
      fields,
    );
  }

  async stop(): Promise<boolean> {
    let ok = true;
    this.stopDispatcher();
    if (this.serverBox.servers.length > 0) {
      const server = firstPresent(this.serverBox.servers, "http server required");
      try {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err instanceof Error) {
              reject(err);
              return;
            }
            if (z.instanceof(Error).safeParse(err).success === true) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      } catch (err) {
        this.reportAppError("stop", "server stop failed", {
          reason: dbErrorMessageForLog(err, "database unavailable"),
        });
        ok = false;
      }
      this.serverBox.servers = [];
    }
    if (this.ownsPool) {
      for (const closePool of this.pool.end) {
        try {
          await closePool();
        } catch (err) {
          this.reportAppError("stop", "pool stop failed", {
            reason: dbErrorMessageForLog(err, "database unavailable"),
          });
          ok = false;
        }
      }
    }
    return ok;
  }

  private finalizeRun(runId: string, run: FlowRun<ModelFieldsInput>, signal: Signal): void {
    run.signal = signal;
    if (signal === Failed) {
      this.runs.delete(runId);
    }
    if (this.runs.size <= runBufferLimit) {
      return;
    }
    for (const [id, entry] of this.runs) {
      if (id !== runId && entry.signal !== Running) {
        this.runs.delete(id);
        if (this.runs.size <= runBufferLimit) {
          return;
        }
      }
    }
  }

  run(): boolean {
    if (this.serverBox.servers.length > 0) {
      return true;
    }
    const portHits = listenPort(this.listen);
    if (portHits.length < 1) {
      return false;
    }
    const port = firstPresent(portHits, "listen port required");
    const server = http.createServer((req, res) => {
      this.handleHttp(req, res).catch((err) => {
        const status = httpStatusForFookieError(err);
        if (
          status === 500 &&
          !(
            err instanceof DatabaseError ||
            err instanceof PgEncodeError ||
            err instanceof ValidationError ||
            err instanceof ModelFieldError ||
            err instanceof NotFoundError
          )
        ) {
          this.reportAppError("handleHttp", "internal error", {
            reason: dbErrorMessageForLog(err, "internal error"),
          });
        } else if (status === 500) {
          this.reportAppError("handleHttp", "internal error", {
            reason: dbErrorMessageForLog(err, "database unavailable"),
          });
        }
        if (res.headersSent === false) {
          sendJson(res, status, httpErrorPayload(err));
        }
      });
    });
    server.once("error", (err) => {
      const reason = dbErrorMessageForLog(err, "database unavailable");
      this.reportAppError("listen", "server listen failed", {
        reason,
      });
      if (this.serverBox.servers.length > 0 && this.serverBox.servers[0] === server) {
        this.serverBox.servers = [];
      }
    });
    server.listen(port);
    this.serverBox.servers = [server];
    this.startDispatcher();
    return true;
  }

  private startDispatcher(): boolean {
    if (this.dispatcherBox.timers.length > 0) {
      return true;
    }
    const timer = setInterval(() => this.runDispatchTick(), dispatchIntervalMs);
    timer.unref();
    this.dispatcherBox.timers = [timer];
    return true;
  }

  private async runDispatchTick(): Promise<boolean> {
    if (this.dispatcherBox.running === true) {
      return false;
    }
    this.dispatcherBox.running = true;
    try {
      await this.tick();
      return true;
    } catch (err) {
      this.reportAppError("dispatch", "dispatcher tick failed", {
        reason: dbErrorMessageForLog(err, "dispatcher tick failed"),
      });
      return false;
    } finally {
      this.dispatcherBox.running = false;
    }
  }

  private stopDispatcher(): boolean {
    if (this.dispatcherBox.timers.length < 1) {
      return true;
    }
    for (const timer of this.dispatcherBox.timers) {
      clearInterval(timer);
    }
    this.dispatcherBox.timers = [];
    this.dispatcherBox.running = false;
    return true;
  }

  create<D extends ModelFieldsInput>(
    model: ModelDef<D>,
    body: InferCreateBody<D>,
  ): Promise<CreateResult<ModelEntity<D>>> {
    const runId = uuidV7();
    const entityId = uuidV7();
    const run: FlowRun<D> = {
      id: runId,
      model,
      operation: "create",
      entityId,
      body: [entityRecordFromPlain(body)],
      filter: [],
      entity: [],
      created: [],
      results: [],
      page: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    const createRt = this.runtimeFor(runId, model, entityId, "create");
    return executeRun(createRt, run).then(async (signal): Promise<CreateResult<ModelEntity<D>>> => {
      this.finalizeRun(runId, run, signal);
      await this.saveRunPhase(runId, run, signal);
      this.publishSettled({
        model: model.name,
        operation: "create",
        id: entityId,
        runId,
        signal,
        rooms: createRt.rooms.names,
      });
      if (signal === Done) {
        for (const created of run.created) {
          if (isModelEntity(model, created) === false) {
            return { signal: Failed, id: entityId, runId };
          }
          return {
            signal: Done,
            id: entityId,
            runId,
            entity: created,
          };
        }
      }
      if (signal === Running) {
        return { signal: Running, id: entityId, runId };
      }
      return { signal: Failed, id: entityId, runId };
    });
  }

  list<D extends ModelFieldsInput>(
    model: ModelDef<D>,
    filter: FilterInput,
    page: ListPage = emptyListPage(),
  ): Promise<ListResult<EntityRecord>> {
    if (z.string().min(1).safeParse(model.name).success === false) {
      throw ValidationError.create("list model required");
    }
    if (Array.isArray(page.order) === false) {
      throw ValidationError.create("list page order required");
    }
    return this.listWith([], model, filter, page);
  }

  private listWith<D extends ModelFieldsInput>(
    pinned: readonly PostgresStore[],
    model: ModelDef<D>,
    filter: FilterInput,
    page: ListPage,
  ): Promise<ListResult<EntityRecord>> {
    const runId = uuidV7();
    const run: FlowRun<D> = {
      id: runId,
      model,
      operation: "list",
      entityId: runId,
      body: [],
      filter: [filter],
      entity: [],
      created: [],
      results: [],
      page: [page],
      signal: Running,
    };
    this.runs.set(runId, run);
    const rt = this.runtimeFor(runId, model, runId, "list", pinned);
    return executeRun(rt, run).then((signal) => {
      if (z.string().min(1).safeParse(runId).success === false) {
        throw ValidationError.create("list run id required");
      }
      if (Array.isArray(run.results) === false) {
        throw ValidationError.create("list results required");
      }
      this.finalizeRun(runId, run, signal);
      return { signal, runId, results: run.results.slice() };
    });
  }

  private async settleMutation(
    runId: string,
    run: FlowRun<ModelFieldsInput>,
    signal: Signal,
    entityId: string,
    rooms: readonly string[] = [],
  ): Promise<MutationResult> {
    if (z.string().min(1).safeParse(runId).success === false) {
      throw ValidationError.create("mutation run id required");
    }
    if (z.string().min(1).safeParse(entityId).success === false) {
      throw ValidationError.create("mutation entity id required");
    }
    this.finalizeRun(runId, run, signal);
    await this.saveRunPhase(runId, run, signal);
    this.publishSettled({
      model: run.model.name,
      operation: run.operation,
      id: entityId,
      runId,
      signal,
      rooms,
    });
    return mutationResult(signal, entityId, runId);
  }

  update<D extends ModelFieldsInput>(
    model: ModelDef<D>,
    input: { id: string; body: UpdateBody<EntityFieldsOf<D>>; filter: FilterInput },
  ): Promise<MutationResult> {
    const runId = uuidV7();
    const run: FlowRun<D> = {
      id: runId,
      model,
      operation: "update",
      entityId: input.id,
      body: [entityRecordFromUpdateBody(input.body)],
      filter: [input.filter],
      entity: [],
      created: [],
      results: [],
      page: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    const mutationRt = this.runtimeFor(runId, model, input.id, "update");
    return executeRun(mutationRt, run).then((signal) =>
      this.settleMutation(runId, run, signal, input.id, mutationRt.rooms.names),
    );
  }

  delete<D extends ModelFieldsInput>(
    model: ModelDef<D>,
    input: { id: string; filter: FilterInput },
  ): Promise<MutationResult> {
    const runId = uuidV7();
    const run: FlowRun<D> = {
      id: runId,
      model,
      operation: "delete",
      entityId: input.id,
      body: [],
      filter: [input.filter],
      entity: [],
      created: [],
      results: [],
      page: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    const mutationRt = this.runtimeFor(runId, model, input.id, "delete");
    return executeRun(mutationRt, run).then((signal) =>
      this.settleMutation(runId, run, signal, input.id, mutationRt.rooms.names),
    );
  }

  resume(runId: string): Promise<Signal> {
    const runHits = mapLookup(this.runs, runId);
    if (runHits.length < 1) {
      return Promise.resolve(Failed);
    }
    const run = firstPresent(runHits, "run required");
    if (run.signal !== Running) {
      return Promise.resolve(run.signal);
    }
    return executeRun(this.runtimeFor(runId, run.model, run.entityId, run.operation), run).then(
      async (signal) => {
        if (z.string().min(1).safeParse(runId).success === false) {
          throw ValidationError.create("resume run id required");
        }
        if (run.signal !== Running && run.signal !== Done && run.signal !== Failed) {
          throw ValidationError.create("resume signal invalid");
        }
        this.finalizeRun(runId, run, signal);
        await this.saveRunPhase(runId, run, signal);
        return signal;
      },
    );
  }

  async setExternalResult(externalResult: {
    externalId: string;
    output: JsonValue;
  }): Promise<boolean> {
    const hydrated = await this.awaitDb();
    if (hydrated === false) {
      return false;
    }
    const outboxHits = mapLookup(this.outbox, externalResult.externalId);
    if (outboxHits.length < 1) {
      return false;
    }
    {
      const outboxRow = firstPresent(outboxHits, "outbox entry required");
      if (outboxRow.status === "completed") {
        return true;
      }
      if (outboxRow.status === "failed") {
        return false;
      }
      const runs = mapLookup(this.runs, outboxRow.runId);
      const resolvedModels = resolveModelByName(this.registeredModels, outboxRow.model);
      let scopeModel = outboxRow.model;
      for (const hit of resolvedModels) {
        scopeModel = hit.name;
      }
      if (resolvedModels.length < 1) {
        for (const run of runs) {
          scopeModel = run.model.name;
        }
      }
      let scopeOperation = "external";
      for (const run of runs) {
        scopeOperation = run.operation;
      }
      const scope: ObsScope = {
        traceId: outboxRow.runId,
        model: scopeModel,
        entityId: outboxRow.entityId,
        operation: scopeOperation,
        parent: [],
      };
      const extHits = resolveExternalByName(this.externals, outboxRow.name);
      if (extHits.length < 1) {
        this.obs.error(scope, "external.result_rejected", {
          reason: "unknown external",
          name: outboxRow.name,
          externalId: outboxRow.externalId,
        });
        this.obs.count(scope, "external.failed");
        this.obs.info(scope, "external.failed", {
          externalId: outboxRow.externalId,
          attempt: outboxRow.attempt,
        });
        const unknownFailed = await this.recordOutbox(outboxFailed(outboxRow));
        if (unknownFailed === false) {
          return false;
        }
        let unknownResumeModel: readonly ModelDef<ModelFieldsInput>[] = [];
        for (const resolvedModel of resolvedModels) {
          unknownResumeModel = [resolvedModel];
        }
        for (const runningRun of runs) {
          unknownResumeModel = [runningRun.model];
        }
        if (unknownResumeModel.length < 1) {
          return false;
        }
        this.obs.info(scope, "flow.resumed", { runId: outboxRow.runId });
        const unknownResumed = await this.resume(outboxRow.runId);
        if (unknownResumed === Failed) {
          this.obs.error(scope, "flow.resume_failed", { runId: outboxRow.runId });
        }
        return false;
      }
      const ext = firstPresent(extHits, "external required");
      const spanAttributes = { externalName: outboxRow.name, externalId: outboxRow.externalId };
      return this.obs.runSpan(scope, "external.result", spanAttributes, async (span) => {
        const validatedHits = catchValidation(() => ext.validateOutput(externalResult.output));
        if (validatedHits.length < 1) {
          if (outboxRow.attempt < ext.attempts) {
            const nextAttempt = outboxRow.attempt + 1;
            this.obs.count(scope, "external.retry");
            this.obs.info(scope, "external.retry", {
              externalId: outboxRow.externalId,
              attempt: nextAttempt,
            });
            const dueAt = new Date(Date.now() + backoffDelayMs(ext.backoff, nextAttempt));
            const recorded = await this.recordOutbox(
              outboxRescheduled(outboxRow, nextAttempt, dueAt.toISOString()),
            );
            if (recorded === false) {
              span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
              return false;
            }
            const emitted = await emitExternalHandler(
              this.onExternalEvent,
              ext,
              outboxRow.externalId,
              outboxRow.input,
            );
            if (emitted !== "emitted") {
              this.obs.error(scope, "external.emit_skipped", {
                reason: emitted === "handler_error" ? "handler error" : "invalid input",
                name: outboxRow.name,
                externalId: outboxRow.externalId,
              });
              const skippedFailed = await this.recordOutbox(
                outboxFailed(outboxPending(outboxRow, nextAttempt)),
              );
              if (skippedFailed === false) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
                return false;
              }
              this.obs.count(scope, "external.failed");
              this.obs.info(scope, "external.failed", {
                externalId: outboxRow.externalId,
                attempt: nextAttempt,
              });
              let skipResumeModel: readonly ModelDef<ModelFieldsInput>[] = [];
              for (const resolvedModel of resolvedModels) {
                skipResumeModel = [resolvedModel];
              }
              for (const runningRun of runs) {
                skipResumeModel = [runningRun.model];
              }
              if (skipResumeModel.length < 1) {
                return false;
              }
              this.obs.info(scope, "flow.resumed", { runId: outboxRow.runId });
              const skipResumed = await this.resume(outboxRow.runId);
              if (skipResumed === Failed) {
                this.obs.error(scope, "flow.resume_failed", { runId: outboxRow.runId });
              }
              return false;
            }
            return false;
          }
          this.obs.count(scope, "external.failed");
          this.obs.info(scope, "external.failed", {
            externalId: outboxRow.externalId,
            attempt: outboxRow.attempt,
          });
          span.setStatus({ code: SpanStatusCode.ERROR, message: "external output invalid" });
          const failedRecorded = await this.recordOutbox(outboxFailed(outboxRow));
          if (failedRecorded === false) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
            return false;
          }
          let failResumeModel: readonly ModelDef<ModelFieldsInput>[] = [];
          for (const resolvedModel of resolvedModels) {
            failResumeModel = [resolvedModel];
          }
          for (const runningRun of runs) {
            failResumeModel = [runningRun.model];
          }
          if (failResumeModel.length < 1) {
            return false;
          }
          this.obs.info(scope, "flow.resumed", { runId: outboxRow.runId });
          const failResumed = await this.resume(outboxRow.runId);
          if (failResumed === Failed) {
            this.obs.error(scope, "flow.resume_failed", { runId: outboxRow.runId });
          }
          return false;
        }
        const validated = firstPresent(validatedHits, "validated body required");
        this.obs.count(scope, "external.completed");
        this.obs.info(scope, "external.completed", { externalId: outboxRow.externalId });
        const completedRecorded = await this.recordOutbox(outboxCompleted(outboxRow, validated));
        if (completedRecorded === false) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
          return false;
        }
        let resumeModel: readonly ModelDef<ModelFieldsInput>[] = [];
        for (const resolvedModel of resolvedModels) {
          resumeModel = [resolvedModel];
        }
        for (const runningRun of runs) {
          resumeModel = [runningRun.model];
        }
        if (resumeModel.length < 1) {
          return true;
        }
        this.obs.info(scope, "flow.resumed", { runId: outboxRow.runId });
        const resumed = await this.resume(outboxRow.runId);
        if (resumed === Failed) {
          this.obs.error(scope, "flow.resume_failed", { runId: outboxRow.runId });
        }
        return true;
      });
    }
  }

  private runBodyOf(bodies: readonly EntityRecord[]): EntityRecord {
    if (Array.isArray(bodies) === false) {
      return {};
    }
    for (const body of bodies) {
      if (z.looseObject({}).safeParse(body).success === false) {
        return {};
      }
      return body;
    }
    return {};
  }

  private rootScope(): ObsScope {
    const dispatcherId = "dispatcher";
    if (z.string().min(1).safeParse(dispatcherId).success === false) {
      throw ValidationError.create("dispatcher scope required");
    }
    return {
      traceId: dispatcherId,
      model: dispatcherId,
      entityId: dispatcherId,
      operation: "dispatch",
      parent: [],
    };
  }

  private async pruneIfDue(nowMs: number): Promise<number> {
    if (nowMs - this.dispatcherBox.prunedAtMs < pruneIntervalMs) {
      return 0;
    }
    this.dispatcherBox.prunedAtMs = nowMs;
    const cutoff = new Date(nowMs - retentionMs).toISOString();
    const removed = await this.store.pruneSettledRuns(cutoff);
    for (const runId of removed) {
      for (const [externalId, outboxRow] of this.outbox) {
        if (outboxRow.runId === runId) {
          this.outbox.delete(externalId);
        }
      }
      this.runs.delete(runId);
    }
    if (removed.length > 0) {
      this.obs.count(this.rootScope(), "saga.pruned");
      this.obs.info(this.rootScope(), "saga.pruned", { runs: removed.length });
    }
    return removed.length;
  }

  private timedOut(outboxRow: OutboxEntry, timeoutMs: number, nowMs: number): boolean {
    if (Number.isFinite(timeoutMs) === false) {
      return false;
    }
    if (timeoutMs < 1) {
      return false;
    }
    for (const iso of outboxRow.dispatchedAt) {
      const sentAt = Date.parse(iso);
      if (Number.isFinite(sentAt) === false) {
        return false;
      }
      return nowMs - sentAt > timeoutMs;
    }
    return false;
  }

  private dueAtMs(outboxRow: OutboxEntry): readonly number[] {
    for (const iso of outboxRow.nextAttemptAt) {
      const parsed = Date.parse(iso);
      if (Number.isFinite(parsed) === true) {
        return [parsed];
      }
    }
    return [];
  }

  private async deadLetter(outboxRow: OutboxEntry, reason: string): Promise<boolean> {
    const scope = this.rootScope();
    const recorded = await this.recordOutbox(outboxDeadLettered(outboxRow, reason));
    if (recorded === false) {
      return false;
    }
    this.obs.count(scope, "external.dead_letter");
    this.obs.error(scope, "external.dead_letter", {
      externalId: outboxRow.externalId,
      externalName: outboxRow.name,
      runId: outboxRow.runId,
      reason,
    });
    const undone = await this.compensateDeadLettered(outboxRow.runId);
    if (undone > 0) {
      await this.saveRunPhaseValue(outboxRow.runId, Phase.Compensating, reason);
      return true;
    }
    await this.markRunStuck(outboxRow.runId, reason);
    return true;
  }

  private async compensateDeadLettered(runId: string): Promise<number> {
    if (z.string().min(1).safeParse(runId).success === false) {
      return 0;
    }
    for (const run of mapLookup(this.runs, runId)) {
      const rt = this.runtimeFor(runId, run.model, run.entityId, run.operation);
      return await compensateRun(rt, runId);
    }
    return 0;
  }

  private async saveRunPhaseValue(runId: string, phase: Phase, reason: string): Promise<boolean> {
    if (z.string().min(1).safeParse(runId).success === false) {
      return false;
    }
    for (const run of mapLookup(this.runs, runId)) {
      return await this.store.saveRunState({
        runId,
        model: run.model.name,
        entityId: run.entityId,
        operation: run.operation,
        body: this.runBodyOf(run.body),
        filterJson: JSON.stringify(run.filter),
        phase,
        pivotExternalId: [],
        error: [reason],
      });
    }
    return false;
  }

  private phaseForSignal(runId: string, signal: Signal): Phase {
    if (signal === Done) {
      return Phase.Completed;
    }
    if (signal === Running) {
      return Phase.Forward;
    }
    let undoing = false;
    for (const outboxRow of this.outbox.values()) {
      if (outboxRow.runId !== runId) {
        continue;
      }
      if (outboxRow.compensationOf.length > 0 && outboxRow.status === "pending") {
        undoing = true;
      }
    }
    if (undoing === true) {
      return Phase.Compensating;
    }
    return Phase.Compensated;
  }

  private async saveRunPhase(
    runId: string,
    run: FlowRun<ModelFieldsInput>,
    signal: Signal,
  ): Promise<boolean> {
    if (z.string().min(1).safeParse(runId).success === false) {
      return false;
    }
    if (run.operation === "list") {
      return false;
    }
    return await this.store.saveRunState({
      runId,
      model: run.model.name,
      entityId: run.entityId,
      operation: run.operation,
      body: this.runBodyOf(run.body),
      filterJson: JSON.stringify(run.filter),
      phase: this.phaseForSignal(runId, signal),
      pivotExternalId: [],
      error: [],
    });
  }

  private async markRunStuck(runId: string, reason: string): Promise<boolean> {
    const scope = this.rootScope();
    if (z.string().min(1).safeParse(runId).success === false) {
      return false;
    }
    this.obs.count(scope, "saga.stuck");
    this.obs.error(scope, "saga.stuck", { runId, reason });
    for (const run of mapLookup(this.runs, runId)) {
      const saved = await this.store.saveRunState({
        runId,
        model: run.model.name,
        entityId: run.entityId,
        operation: run.operation,
        body: this.runBodyOf(run.body),
        filterJson: JSON.stringify(run.filter),
        phase: Phase.Stuck,
        pivotExternalId: [],
        error: [reason],
      });
      return saved;
    }
    return false;
  }

  async tick(): Promise<number> {
    const scope = this.rootScope();
    const dbOk = await this.awaitDb();
    if (dbOk === false) {
      return 0;
    }
    const nowMs = Date.now();
    await this.pruneIfDue(nowMs);
    let dispatched = 0;
    const dueRows = Array.from(this.outbox.values());
    for (const outboxRow of dueRows) {
      if (outboxRow.status !== "pending") {
        continue;
      }
      const dueHits = this.dueAtMs(outboxRow);
      if (dueHits.length < 1) {
        continue;
      }
      const due = firstPresent(dueHits, "due timestamp required");
      if (due > nowMs) {
        continue;
      }
      const extHits = resolveExternalByName(this.externals, outboxRow.name);
      if (extHits.length < 1) {
        await this.deadLetter(outboxRow, "unknown external");
        continue;
      }
      const ext = firstPresent(extHits, "external required");
      const expired = this.timedOut(outboxRow, ext.timeoutMs, nowMs);
      if (expired === true) {
        this.obs.count(scope, "external.timed_out");
        this.obs.error(scope, "external.timed_out", {
          externalId: outboxRow.externalId,
          externalName: outboxRow.name,
          timeoutMs: ext.timeoutMs,
        });
      }
      if (outboxRow.attempt >= ext.attempts) {
        const reason = expired === true ? "timed out" : "attempts exhausted";
        await this.deadLetter(outboxRow, reason);
        continue;
      }
      const nextAttempt = outboxRow.attempt + 1;
      const delay = backoffDelayMs(ext.backoff, nextAttempt);
      const rescheduled = outboxRescheduled(
        outboxRow,
        nextAttempt,
        new Date(nowMs + delay).toISOString(),
      );
      const recorded = await this.recordOutbox(rescheduled);
      if (recorded === false) {
        continue;
      }
      this.obs.count(scope, "external.retry");
      this.obs.info(scope, "external.retry", {
        externalId: outboxRow.externalId,
        externalName: outboxRow.name,
        attempt: nextAttempt,
      });
      await emitExternalHandler(this.onExternalEvent, ext, outboxRow.externalId, outboxRow.input);
      dispatched += 1;
    }
    return dispatched;
  }

  async setExternalFailure(failure: {
    externalId: string;
    reason: string;
    failure: FailureClass;
  }): Promise<boolean> {
    const scope = this.rootScope();
    if (z.string().min(1).safeParse(failure.externalId).success === false) {
      return false;
    }
    if (z.string().min(1).safeParse(failure.reason).success === false) {
      return false;
    }
    const dbOk = await this.awaitDb();
    if (dbOk === false) {
      return false;
    }
    for (const outboxRow of mapLookup(this.outbox, failure.externalId)) {
      if (outboxRow.status !== "pending") {
        return false;
      }
      const extHits = resolveExternalByName(this.externals, outboxRow.name);
      if (extHits.length < 1) {
        return await this.deadLetter(outboxRow, failure.reason);
      }
      const ext = firstPresent(extHits, "external required");
      const budgetLeft = outboxRow.attempt < ext.attempts;
      if (failure.failure === FailureClass.Transient && budgetLeft === true) {
        const nextAttempt = outboxRow.attempt + 1;
        const dueAt = new Date(Date.now() + backoffDelayMs(ext.backoff, nextAttempt));
        this.obs.count(scope, "external.transient_failure");
        this.obs.info(scope, "external.transient_failure", {
          externalId: outboxRow.externalId,
          attempt: nextAttempt,
          reason: failure.reason,
        });
        return await this.recordOutbox(
          outboxRescheduled(outboxRow, nextAttempt, dueAt.toISOString()),
        );
      }
      this.obs.count(scope, "external.permanent_failure");
      return await this.deadLetter(outboxRow, failure.reason);
    }
    return false;
  }

  async retryExternal(externalId: string): Promise<boolean> {
    if (z.string().min(1).safeParse(externalId).success === false) {
      return false;
    }
    const dbOk = await this.awaitDb();
    if (dbOk === false) {
      return false;
    }
    for (const outboxRow of mapLookup(this.outbox, externalId)) {
      if (outboxRow.status !== "dead_letter") {
        return false;
      }
      this.obs.count(this.rootScope(), "external.retry_requested");
      return await this.recordOutbox(
        outboxRescheduled(outboxRow, 1, new Date(Date.now()).toISOString()),
      );
    }
    return false;
  }

  deadLetters(): OutboxEntry[] {
    let rows: OutboxEntry[] = [];
    for (const outboxRow of this.outbox.values()) {
      if (outboxRow.status === "dead_letter") {
        rows = rows.concat([outboxRow]);
      }
    }
    return rows;
  }

  async sagaRun(runId: string): Promise<readonly RunStateRow[]> {
    if (z.string().min(1).safeParse(runId).success === false) {
      return [];
    }
    const dbOk = await this.awaitDb();
    if (dbOk === false) {
      return [];
    }
    return await this.store.loadRunState(runId);
  }

  catalog(): readonly ModelSummary[] {
    if (this.registeredModels.length < 1) {
      throw ValidationError.create("registered models required");
    }
    let summaries: readonly ModelSummary[] = [];
    for (const model of this.registeredModels) {
      summaries = appendItem(summaries, modelSummaryOf(model));
    }
    return summaries;
  }

  externalCatalog(): readonly ExternalSummary[] {
    if (Array.isArray(this.externals) === false) {
      throw ValidationError.create("registered externals required");
    }
    let summaries: readonly ExternalSummary[] = [];
    for (const external of this.externals) {
      summaries = appendItem(summaries, externalSummaryOf(external));
    }
    return summaries;
  }

  models(): readonly RegisteredModel[] {
    if (this.registeredModels.length < 1) {
      throw ValidationError.create("registered models required");
    }
    if (Array.isArray(this.registeredModels) === false) {
      throw ValidationError.create("registered models required");
    }
    return this.registeredModels.slice();
  }

  async sql(statement: string, params: readonly PgParam[]): Promise<readonly PgRow[]> {
    if (z.string().min(1).safeParse(statement).success === false) {
      throw ValidationError.create("sql statement required");
    }
    if (Array.isArray(params) === false) {
      throw ValidationError.create("sql params required");
    }
    await this.awaitDb();
    return await this.store.selectRows(statement, params);
  }

  async runList(query: RunQuery): Promise<readonly RunStateRow[]> {
    if (Array.isArray(query.phase) === false) {
      throw ValidationError.create("run query phase required");
    }
    if (Number.isInteger(query.limit) === false) {
      throw ValidationError.create("run query limit required");
    }
    await this.awaitDb();
    return await this.store.queryRuns(query);
  }

  async outboxList(query: OutboxQuery): Promise<readonly OutboxEntry[]> {
    if (Array.isArray(query.status) === false) {
      throw ValidationError.create("outbox query status required");
    }
    if (Array.isArray(query.runId) === false) {
      throw ValidationError.create("outbox query run id required");
    }
    await this.awaitDb();
    return await this.store.queryOutbox(query);
  }

  onOperationSettled(listener: OperationListener): OperationSubscription {
    if (z.instanceof(Function).safeParse(listener).success === false) {
      throw ValidationError.create("operation listener required");
    }
    this.listenerBox.listeners = appendItem(this.listenerBox.listeners, listener);
    return {
      stop: () => {
        if (Array.isArray(this.listenerBox.listeners) === false) {
          throw ValidationError.create("operation listeners required");
        }
        const before = this.listenerBox.listeners.length;
        this.listenerBox.listeners = this.listenerBox.listeners.filter(
          (registered) => registered !== listener,
        );
        return this.listenerBox.listeners.length < before;
      },
    };
  }

  private publishSettled(event: OperationEvent): void {
    if (z.string().min(1).safeParse(event.model).success === false) {
      throw ValidationError.create("settled event model required");
    }
    for (const listener of this.listenerBox.listeners) {
      try {
        listener(event);
      } catch (err) {
        this.reportAppError("settled", "operation listener failed", {
          reason: dbErrorMessageForLog(err, "listener failed"),
          model: event.model,
        });
      }
    }
  }

  observability(since: number): ObservabilityPage {
    if (Number.isInteger(since) === false || since < 0) {
      throw ValidationError.create("observability cursor must be a non-negative integer");
    }
    const logs = this.obs.buffers.logs.filter((logEntry) => logEntry.seq > since);
    const metrics = this.obs.buffers.metrics.filter((metricEntry) => metricEntry.seq > since);
    const spans = this.obs.buffers.spans.filter((spanEntry) => spanEntry.seq > since);
    let nextSeq = since;
    let oldestSeq = 0;
    for (const seq of this.bufferSeqs()) {
      if (seq > nextSeq) {
        nextSeq = seq;
      }
      if (oldestSeq === 0 || seq < oldestSeq) {
        oldestSeq = seq;
      }
    }
    return { logs, metrics, spans, nextSeq, oldestSeq };
  }

  private bufferSeqs(): readonly number[] {
    let seqs: readonly number[] = [];
    for (const logEntry of this.obs.buffers.logs) {
      seqs = appendItem(seqs, logEntry.seq);
    }
    for (const metricEntry of this.obs.buffers.metrics) {
      seqs = appendItem(seqs, metricEntry.seq);
    }
    for (const spanEntry of this.obs.buffers.spans) {
      seqs = appendItem(seqs, spanEntry.seq);
    }
    return seqs;
  }

  logs(): LogEntry[] {
    if (Array.isArray(this.obs.buffers.logs) === false) {
      throw ValidationError.create("log buffer required");
    }
    const copied = this.obs.buffers.logs.slice();
    if (Array.isArray(copied) === false) {
      throw ValidationError.create("log copy required");
    }
    return copied;
  }

  metrics(): MetricEntry[] {
    if (Array.isArray(this.obs.buffers.metrics) === false) {
      throw ValidationError.create("metric buffer required");
    }
    const copied = this.obs.buffers.metrics.slice();
    if (Array.isArray(copied) === false) {
      throw ValidationError.create("metric copy required");
    }
    return copied;
  }

  spans(): SpanEntry[] {
    if (Array.isArray(this.obs.buffers.spans) === false) {
      throw ValidationError.create("span buffer required");
    }
    const copied = this.obs.buffers.spans.slice();
    if (Array.isArray(copied) === false) {
      throw ValidationError.create("span copy required");
    }
    return copied;
  }

  private async recordOutbox(outboxRow: OutboxEntry): Promise<boolean> {
    const previous = mapLookup(this.outbox, outboxRow.externalId);
    this.outbox.set(outboxRow.externalId, outboxRow);
    const ok = await this.store.saveOutboxEntry(outboxRow);
    if (ok === false) {
      if (previous.length < 1) {
        this.outbox.delete(outboxRow.externalId);
      } else {
        for (const prior of previous) {
          this.outbox.set(outboxRow.externalId, prior);
        }
      }
      return false;
    }
    return true;
  }

  async withReadSnapshot<T>(run: (scope: ReadScope) => Promise<T>): Promise<T> {
    await this.awaitDb();
    const client = await this.pool.connect();
    const pinned = this.store.withClient(client);
    let opened = false;
    try {
      await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
      opened = true;
      await client.query(`SET LOCAL statement_timeout = ${snapshotStatementTimeoutMs}`);
      await client.query(
        `SET LOCAL idle_in_transaction_session_timeout = ${snapshotIdleTimeoutMs}`,
      );
      const scope: ReadScope = {
        list: (model, filter, page = emptyListPage()) =>
          this.listWith([pinned], model, filter, page),
        sql: (statement, params) => pinned.selectRows(statement, params),
      };
      return await run(scope);
    } finally {
      if (opened === true) {
        try {
          await client.query("COMMIT");
        } catch (err) {
          this.reportAppError("snapshot", "snapshot commit failed", {
            reason: dbErrorMessageForLog(err, "database unavailable"),
          });
        }
      }
      client.release();
    }
  }

  private storeOf(pinned: readonly PostgresStore[]): PostgresStore {
    if (Array.isArray(pinned) === false) {
      throw ValidationError.create("pinned store required");
    }
    for (const store of pinned) {
      return store;
    }
    return this.store;
  }

  private runtimeFor(
    traceId: string,
    model: ModelDef<ModelFieldsInput>,
    entityId: string,
    operation: string,
    pinned: readonly PostgresStore[] = [],
  ): Runtime<E> {
    return {
      traceId,
      model,
      entityId,
      operation,
      parent: [],
      rooms: { names: [] },
      obs: this.obs,
      outbox: this.outbox,
      onExternalEvent: this.onExternalEvent,
      models: this.registeredModels,
      externals: this.externals,
      entities: this.entities,
      pool: this.pool,
      store: this.storeOf(pinned),
      pendingExternalEvents: this.pendingExternalEvents,
      pendingEntityWrites: this.pendingEntityWrites,
      nestedSteps: { steps: 0 },
      reportDbError: (message: string) => {
        if (z.string().safeParse(message).success === false) {
          this.dbErrorBox.messages = [];
          return;
        }
        if (message.length < 1) {
          this.dbErrorBox.messages = [];
          return;
        }
        this.dbErrorBox.messages = [message];
      },
      clearDbError: () => {
        if (Array.isArray(this.dbErrorBox.messages) === false) {
          this.dbErrorBox.messages = [];
          return;
        }
        if (this.dbErrorBox.messages.length > 0) {
          this.dbErrorBox.messages = [];
        }
      },
      dbLastError: () => this.dbErrorBox.messages,
      awaitDb: () => this.awaitDb(),
      resume: (runId) => this.resume(runId),
    };
  }

  private async awaitDb(): Promise<boolean> {
    if (this.dbReadyBox.ready === true) {
      return true;
    }
    const errorBox: DbErrorBox = { message: "database unavailable" };
    const tablesOk = await this.store.ensureAllTables(this.registeredModels, errorBox);
    if (tablesOk === false) {
      this.dbErrorBox.messages = [dbErrorBoxText(errorBox)];
      return false;
    }
    const outboxOk = await this.store.loadOutbox(this.outbox, errorBox);
    if (outboxOk === false) {
      this.dbErrorBox.messages = [dbErrorBoxText(errorBox)];
      return false;
    }
    this.dbReadyBox.ready = true;
    await this.recoverRuns();
    return true;
  }

  private restoredFilter(
    filterJson: string,
    model: ModelDef<ModelFieldsInput>,
  ): readonly FilterInput[] {
    const parsedHits = catchValidation(() => {
      const raw: JsonValue = JSON.parse(filterJson);
      if (Array.isArray(raw) === false) {
        throw ValidationError.create("run filter invalid");
      }
      let restored: readonly FilterInput[] = [];
      for (const filterEntry of raw) {
        restored = appendItem(restored, model.validateListFilter(filterEntry));
      }
      return restored;
    });
    for (const restored of parsedHits) {
      return restored;
    }
    return [];
  }

  private async recoverRuns(): Promise<number> {
    const scope = this.rootScope();
    const rows = await this.store.loadResumableRuns(runBufferLimit);
    let restored = 0;
    for (const runState of rows) {
      if (this.runs.has(runState.runId) === true) {
        continue;
      }
      const modelHits = resolveModelByName(this.registeredModels, runState.model);
      if (modelHits.length < 1) {
        this.obs.count(scope, "saga.recovery_model_missing");
        this.obs.error(scope, "saga.recovery_model_missing", {
          runId: runState.runId,
          model: runState.model,
        });
        await this.store.saveRunState({
          runId: runState.runId,
          model: runState.model,
          entityId: runState.entityId,
          operation: runState.operation,
          body: runState.body,
          filterJson: runState.filterJson,
          phase: Phase.Stuck,
          pivotExternalId: [],
          error: ["model no longer registered"],
        });
        continue;
      }
      const model = firstPresent(modelHits, "recovered model required");
      if (isFlowOperation(runState.operation) === false) {
        this.obs.error(scope, "saga.recovery_operation_invalid", {
          runId: runState.runId,
          operation: runState.operation,
        });
        continue;
      }
      this.runs.set(runState.runId, {
        id: runState.runId,
        model,
        operation: runState.operation,
        entityId: runState.entityId,
        body: [runState.body],
        filter: this.restoredFilter(runState.filterJson, model),
        entity: [],
        created: [],
        results: [],
        page: [],
        signal: Running,
      });
      restored += 1;
    }
    if (restored > 0) {
      this.obs.count(scope, "saga.recovered");
      this.obs.info(scope, "saga.recovered", { runs: restored });
    }
    return restored;
  }

  private async handleHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    return await routeHttp(
      {
        registeredModels: this.registeredModels,
        runs: this.runs,
        runtimeFor: (traceId, model, entityId, operation) =>
          this.runtimeFor(traceId, model, entityId, operation),
        finalizeRun: (runId, run, signal) => this.finalizeRun(runId, run, signal),
        setExternalResult: (input) => this.setExternalResult(input),
        setExternalFailure: (input) => this.setExternalFailure(input),
      },
      req,
      res,
    );
  }
}

export type AppInstance = App;

export function app<const E extends readonly ExternalDef[]>(config: AppConfig<E>): App<E> {
  if (z.looseObject({}).safeParse(config).success === false) {
    throw ValidationError.create("app config required");
  }
  if (Array.isArray(config.models) === false) {
    throw ValidationError.create("app models required");
  }
  if (config.models.length < 1) {
    throw ValidationError.create("app models required");
  }
  return App.create(config);
}
