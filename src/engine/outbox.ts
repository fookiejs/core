import { z } from "zod";
import { SpanStatusCode } from "@opentelemetry/api";
import { logDatabaseFailure } from "./flow.ts";
import type { ExternalResult } from "./flow.ts";
import { externalStepId, inputFingerprint } from "./ids.ts";
import type { Runtime } from "./runtime.ts";
import { ValidationError } from "../errors.ts";
import { parseExternalInput, parseExternalOutput } from "../external.ts";
import type {
  ExternalDef,
  ExternalEventOf,
  InferExternalInputFrom,
  InferExternalOutputFrom,
} from "../external.ts";
import { obsScope } from "../observability.ts";
import { Done, Failed, Running } from "../signal.ts";
import type {
  OutboxBlockedStatus,
  OutboxCompletedStatus,
  OutboxDeadLetterStatus,
  OutboxFailedStatus,
  OutboxPendingStatus,
} from "../signal.ts";
import { appendItem, catchValidation, firstPresent, mapLookup } from "../slot.ts";
import type { ScalarSchema } from "../types/type.ts";
import type { EntityRecord } from "../values.ts";

export type OutboxSaga = {
  stepIndex: number;
  undoable: boolean;
  nextAttemptAt: readonly string[];
  error: readonly string[];
  compensationOf: readonly string[];
  dispatchedAt: readonly string[];
};

export type OutboxEntry<
  I extends Record<string, ScalarSchema> = Record<string, ScalarSchema>,
  O extends Record<string, ScalarSchema> = Record<string, ScalarSchema>,
> = {
  externalId: string;
  name: string;
  entityId: string;
  model: string;
  runId: string;
  attempt: number;
  input: InferExternalInputFrom<I>;
} & OutboxSaga &
  OutboxStatusPayloadKinds<O>[keyof OutboxStatusPayloadKinds<O>];

export type OutboxStatusPayloadKinds<O extends Record<string, ScalarSchema>> = {
  pending: { status: OutboxPendingStatus };
  failed: { status: OutboxFailedStatus };
  blocked: { status: OutboxBlockedStatus };
  deadLetter: { status: OutboxDeadLetterStatus };
  completed: { status: OutboxCompletedStatus; output: InferExternalOutputFrom<O> };
};

export function sagaOf(outboxRow: OutboxEntry): OutboxSaga {
  return {
    stepIndex: outboxRow.stepIndex,
    undoable: outboxRow.undoable,
    nextAttemptAt: outboxRow.nextAttemptAt,
    error: outboxRow.error,
    compensationOf: outboxRow.compensationOf,
    dispatchedAt: outboxRow.dispatchedAt,
  };
}

export type EmitExternalResultKinds = {
  emitted: "emitted";
  invalid_input: "invalid_input";
  handler_error: "handler_error";
};

export type EmitExternalResult = EmitExternalResultKinds[keyof EmitExternalResultKinds];

export async function emitExternalHandler<E extends readonly ExternalDef[]>(
  handler: (event: ExternalEventOf<E[number]>) => Promise<void>,
  ext: ExternalDef,
  externalId: string,
  input: EntityRecord,
): Promise<EmitExternalResult> {
  const parsedHits = catchValidation(() => parseExternalInput(ext.input, input));
  if (parsedHits.length < 1) {
    return "invalid_input";
  }
  const parsed = firstPresent(parsedHits, "external input required");
  try {
    await handler({
      externalId,
      name: ext.name,
      input: parsed,
    });
  } catch {
    return "handler_error";
  }
  return "emitted";
}

export async function failClosePendingOutbox(rt: Runtime, externalId: string): Promise<boolean> {
  for (const previous of mapLookup(rt.outbox, externalId)) {
    if (previous.status === "failed") {
      return true;
    }
    if (previous.status !== "pending") {
      return false;
    }
    const failed = outboxFailed(previous);
    rt.outbox.set(externalId, failed);
    const ok = await rt.store.saveOutboxEntry(failed);
    if (ok === false) {
      rt.outbox.set(externalId, previous);
      return false;
    }
    return true;
  }
  return false;
}

export async function flushPendingExternalEvents(rt: Runtime): Promise<boolean> {
  const scope = obsScope(rt);
  let flushed = true;
  while (rt.pendingExternalEvents.events.length > 0) {
    const event = firstPresent(rt.pendingExternalEvents.events, "pending external event required");
    const extHits = resolveExternalByName(rt.externals, event.name);
    if (extHits.length < 1) {
      rt.obs.error(scope, "external.emit_skipped", {
        reason: "unknown external",
        name: event.name,
        externalId: event.externalId,
      });
      const closed = await failClosePendingOutbox(rt, event.externalId);
      if (closed === true) {
        rt.obs.count(scope, "external.failed");
        rt.obs.info(scope, "external.failed", {
          externalId: event.externalId,
          reason: "unknown external",
        });
      }
      flushed = false;
      rt.pendingExternalEvents.events = rt.pendingExternalEvents.events.slice(1);
      continue;
    }
    const ext = firstPresent(extHits, "external required");
    const emitted = await emitExternalHandler(
      rt.onExternalEvent,
      ext,
      event.externalId,
      event.input,
    );
    if (emitted !== "emitted") {
      let alreadyCompleted = false;
      for (const acked of mapLookup(rt.outbox, event.externalId)) {
        if (acked.status === "completed") {
          alreadyCompleted = true;
        }
      }
      if (alreadyCompleted === true) {
        rt.pendingExternalEvents.events = rt.pendingExternalEvents.events.slice(1);
        continue;
      }
      const reason = emitted === "handler_error" ? "handler error" : "invalid input";
      rt.obs.error(scope, "external.emit_skipped", {
        reason,
        name: event.name,
        externalId: event.externalId,
      });
      const closed = await failClosePendingOutbox(rt, event.externalId);
      if (closed === true) {
        rt.obs.count(scope, "external.failed");
        rt.obs.info(scope, "external.failed", {
          externalId: event.externalId,
          reason,
        });
      }
      flushed = false;
    }
    rt.pendingExternalEvents.events = rt.pendingExternalEvents.events.slice(1);
  }
  return flushed;
}

export function resolveExternalByName<E extends readonly ExternalDef[]>(
  externals: E,
  name: string,
): E[number][] {
  if (Array.isArray(externals) === false) {
    throw ValidationError.create("externals list required");
  }
  if (z.string().min(1).safeParse(name).success === false) {
    throw ValidationError.create("external name required");
  }
  for (const ext of externals) {
    if (ext.name === name) {
      return [ext];
    }
  }
  return [];
}

export async function runExternal<
  I extends Record<string, ScalarSchema>,
  O extends Record<string, ScalarSchema>,
>(
  rt: Runtime,
  ext: ExternalDef<I, O>,
  input: InferExternalInputFrom<I>,
): Promise<ExternalResult<InferExternalOutputFrom<O>>> {
  const validatedHits = catchValidation(() => ext.validateInput(input));
  if (validatedHits.length < 1) {
    return { signal: Failed };
  }
  const validated = firstPresent(validatedHits, "external input required");

  const identity = externalStepId(rt.nestedSteps, rt.traceId, rt.entityId, ext.name);
  const id = identity.externalId;
  const scope = obsScope(rt);
  return await rt.obs.runSpan(
    scope,
    ext.name,
    { externalName: ext.name, externalId: id },
    async (span) => {
      const existing = mapLookup(rt.outbox, id);
      for (const replayed of existing) {
        if (inputFingerprint(replayed.input) === inputFingerprint(validated)) {
          continue;
        }
        rt.obs.count(scope, "saga.nondeterministic_replay");
        rt.obs.error(scope, "saga.nondeterministic_replay", {
          externalId: id,
          stepIndex: identity.stepIndex,
          externalName: ext.name,
        });
        span.setAttribute("signal", Failed);
        span.setStatus({ code: SpanStatusCode.ERROR, message: "nondeterministic replay" });
        return { signal: Failed };
      }
      const completedEntries = existing.filter((outboxEntry) => outboxEntry.status === "completed");
      const outputValidHits = catchValidation(() => {
        const completedEntry = firstPresent(completedEntries, "completed outbox entry required");
        if (completedEntry.status !== "completed") {
          throw ValidationError.create("completed outbox entry required");
        }
        if (completedEntry.name !== ext.name) {
          throw ValidationError.create("outbox external mismatch");
        }
        return parseExternalOutput(ext.output, completedEntry.output);
      });

      for (const outboxHit of existing) {
        if (outboxHit.status === "completed") {
          if (outputValidHits.length < 1) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: "external output invalid" });
            return { signal: Failed };
          }
          const outputValid = firstPresent(outputValidHits, "external output required");
          span.setAttribute("signal", Done);
          return {
            output: outputValid,
            signal: Done,
          };
        }
        if (outboxHit.status === "failed") {
          span.setAttribute("signal", Failed);
          span.setStatus({ code: SpanStatusCode.ERROR, message: "external failed" });
          return { signal: Failed };
        }
      }

      if (existing.length < 1) {
        const pending = outboxPendingEntry(
          {
            externalId: id,
            name: ext.name,
            input: validated,
            entityId: rt.entityId,
            model: rt.model.name,
            runId: rt.traceId,
            attempt: 1,
          },
          {
            stepIndex: identity.stepIndex,
            undoable: ext.compensate.length > 0,
            nextAttemptAt: [new Date(Date.now()).toISOString()],
            error: [],
            compensationOf: [],
            dispatchedAt: [new Date(Date.now()).toISOString()],
          },
        );
        rt.outbox.set(id, pending);
        const saved = await rt.store.saveOutboxEntry(pending);
        if (saved === false) {
          rt.outbox.delete(id);
          logDatabaseFailure(rt);
          span.setAttribute("signal", Failed);
          span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
          return { signal: Failed };
        }
        rt.obs.count(scope, "external.dispatched");
        rt.obs.info(scope, "external.dispatch", { externalId: id, externalName: ext.name });
        rt.pendingExternalEvents.events = appendItem(rt.pendingExternalEvents.events, {
          externalId: id,
          name: ext.name,
          input: validated,
        });
      }

      span.setAttribute("signal", Running);
      return { signal: Running };
    },
  );
}

export type OutboxIdentity = {
  externalId: string;
  name: string;
  input: EntityRecord;
  entityId: string;
  model: string;
  runId: string;
  attempt: number;
};

export function outboxPendingEntry(identity: OutboxIdentity, saga: OutboxSaga): OutboxEntry {
  return {
    externalId: identity.externalId,
    name: identity.name,
    entityId: identity.entityId,
    model: identity.model,
    runId: identity.runId,
    input: identity.input,
    attempt: identity.attempt,
    stepIndex: saga.stepIndex,
    undoable: saga.undoable,
    nextAttemptAt: saga.nextAttemptAt,
    error: saga.error,
    compensationOf: saga.compensationOf,
    dispatchedAt: saga.dispatchedAt,
    status: "pending",
  };
}

export function outboxPending(outboxRow: OutboxEntry, attempt: number): OutboxEntry {
  return outboxPendingEntry(
    {
      externalId: outboxRow.externalId,
      name: outboxRow.name,
      input: outboxRow.input,
      entityId: outboxRow.entityId,
      model: outboxRow.model,
      runId: outboxRow.runId,
      attempt,
    },
    sagaOf(outboxRow),
  );
}

export function outboxRescheduled(
  outboxRow: OutboxEntry,
  attempt: number,
  nextAttemptAt: string,
): OutboxEntry {
  return outboxPendingEntry(
    {
      externalId: outboxRow.externalId,
      name: outboxRow.name,
      input: outboxRow.input,
      entityId: outboxRow.entityId,
      model: outboxRow.model,
      runId: outboxRow.runId,
      attempt,
    },
    {
      stepIndex: outboxRow.stepIndex,
      undoable: outboxRow.undoable,
      nextAttemptAt: [nextAttemptAt],
      error: outboxRow.error,
      compensationOf: outboxRow.compensationOf,
      dispatchedAt: [new Date(Date.now()).toISOString()],
    },
  );
}

export function outboxFailed(outboxRow: OutboxEntry): OutboxEntry {
  return {
    externalId: outboxRow.externalId,
    name: outboxRow.name,
    entityId: outboxRow.entityId,
    model: outboxRow.model,
    runId: outboxRow.runId,
    input: outboxRow.input,
    attempt: outboxRow.attempt,
    stepIndex: outboxRow.stepIndex,
    undoable: outboxRow.undoable,
    nextAttemptAt: outboxRow.nextAttemptAt,
    error: outboxRow.error,
    compensationOf: outboxRow.compensationOf,
    dispatchedAt: outboxRow.dispatchedAt,
    status: "failed",
  };
}

export function outboxDeadLettered(outboxRow: OutboxEntry, reason: string): OutboxEntry {
  return {
    externalId: outboxRow.externalId,
    name: outboxRow.name,
    entityId: outboxRow.entityId,
    model: outboxRow.model,
    runId: outboxRow.runId,
    input: outboxRow.input,
    attempt: outboxRow.attempt,
    stepIndex: outboxRow.stepIndex,
    undoable: outboxRow.undoable,
    nextAttemptAt: [],
    error: [reason],
    compensationOf: outboxRow.compensationOf,
    dispatchedAt: outboxRow.dispatchedAt,
    status: "dead_letter",
  };
}

export function outboxCompleted(outboxRow: OutboxEntry, output: EntityRecord): OutboxEntry {
  return {
    externalId: outboxRow.externalId,
    name: outboxRow.name,
    entityId: outboxRow.entityId,
    model: outboxRow.model,
    runId: outboxRow.runId,
    input: outboxRow.input,
    attempt: outboxRow.attempt,
    stepIndex: outboxRow.stepIndex,
    undoable: outboxRow.undoable,
    nextAttemptAt: [],
    error: outboxRow.error,
    compensationOf: outboxRow.compensationOf,
    dispatchedAt: outboxRow.dispatchedAt,
    status: "completed",
    output,
  };
}
