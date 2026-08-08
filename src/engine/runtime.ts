import { z } from "zod";
import { flushPendingExternalEvents } from "./outbox.ts";
import type { OutboxEntry } from "./outbox.ts";
import { ValidationError } from "../errors.ts";
import type { ExternalDef, ExternalEventOf } from "../external.ts";
import type { FilterInput } from "../filter/schema.ts";
import type { ModelDef, ModelFieldsInput, ModelRef } from "../model.ts";
import {
  Observability,
  entityCacheLimit,
  lockTimeoutMs,
  maxWriteAttempts,
  writeRetryBackoffMs,
} from "../observability.ts";
import { dbErrorMessageForLog, sqlStateOf } from "../pg/encode.ts";
import type { InjectablePool, PgClient } from "../pg/pool.ts";
import { PostgresStore } from "../pg/store.ts";
import { Failed, Running } from "../signal.ts";
import type { Signal } from "../signal.ts";
import { appendItem } from "../slot.ts";
import { entityValueAt } from "../values.ts";
import type { CaughtFailure, EntityRecord } from "../values.ts";

export type PendingExternalEvent = {
  externalId: string;
  name: string;
  input: EntityRecord;
};

export type PendingEntityWrite = {
  key: string;
  entity: EntityRecord;
  model: string;
  entityId: string;
  created: boolean;
};

export type PendingWriteQueue = {
  rows: readonly PendingEntityWrite[];
};

export type PendingEventQueue = {
  events: readonly PendingExternalEvent[];
};

export type NestedStepCursor = {
  steps: number;
};

export type EmissionCursor = {
  seen: number;
  published: number;
};

export type RoomBox = {
  names: readonly string[];
};

export type RuntimeParent = {
  model: string;
  entityId: string;
};

export type Runtime<E extends readonly ExternalDef[] = readonly ExternalDef[]> = {
  traceId: string;
  model: ModelDef<ModelFieldsInput>;
  entityId: string;
  operation: string;
  parent: readonly RuntimeParent[];
  rooms: RoomBox;
  obs: Observability;
  outbox: Map<string, OutboxEntry>;
  onExternalEvent: (event: ExternalEventOf<E[number]>) => Promise<void>;
  models: ReadonlyArray<ModelDef<ModelFieldsInput>>;
  externals: E;
  resume: (runId: string) => Promise<Signal>;
  entities: Map<string, EntityRecord>;
  pool: InjectablePool;
  store: PostgresStore;
  awaitDb: () => Promise<boolean>;
  reportDbError: (message: string) => void;
  clearDbError: () => void;
  dbLastError: () => readonly string[];
  pendingExternalEvents: PendingEventQueue;
  pendingEntityWrites: PendingWriteQueue;
  nestedSteps: NestedStepCursor;
  emissions: EmissionCursor;
};

export function cacheEntity(
  entities: Map<string, EntityRecord>,
  key: string,
  entity: EntityRecord,
): void {
  entities.set(key, entity);
  if (entities.size <= entityCacheLimit) {
    return;
  }
  for (const oldest of entities.keys()) {
    if (oldest === key) {
      continue;
    }
    entities.delete(oldest);
    if (entities.size <= entityCacheLimit) {
      return;
    }
  }
}

export function clearPendingWork(rt: Runtime): void {
  if (z.looseObject({}).safeParse(rt).success === false) {
    throw ValidationError.create("runtime required");
  }
  for (const event of rt.pendingExternalEvents.events) {
    if (z.string().min(1).safeParse(event.externalId).success === false) {
      throw ValidationError.create("pending external id required");
    }
    rt.outbox.delete(event.externalId);
  }
  rt.pendingExternalEvents.events = [];
  rt.pendingEntityWrites.rows = [];
}

export function flushPendingEntityWrites(rt: Runtime): void {
  const writes = rt.pendingEntityWrites.rows;
  rt.pendingEntityWrites.rows = [];
  for (const write of writes) {
    let deletedTrues: readonly true[] = [];
    for (const deleted of entityValueAt(write.entity, "isDeleted")) {
      if (deleted === true) {
        deletedTrues = appendItem(deletedTrues, true);
      }
    }
    if (deletedTrues.length > 0) {
      rt.entities.delete(write.key);
    } else {
      cacheEntity(rt.entities, write.key, write.entity);
    }
  }
}

export function transactionRuntime(rt: Runtime, client: PgClient): Runtime {
  const store = rt.store.withClient(client);
  return {
    traceId: rt.traceId,
    model: rt.model,
    entityId: rt.entityId,
    operation: rt.operation,
    parent: rt.parent,
    rooms: rt.rooms,
    obs: rt.obs,
    outbox: rt.outbox,
    onExternalEvent: rt.onExternalEvent,
    models: rt.models,
    externals: rt.externals,
    resume: rt.resume,
    entities: rt.entities,
    pool: rt.pool,
    store,
    awaitDb: rt.awaitDb,
    reportDbError: rt.reportDbError,
    clearDbError: rt.clearDbError,
    dbLastError: rt.dbLastError,
    pendingEntityWrites: { rows: [] },
    pendingExternalEvents: { events: [] },
    nestedSteps: rt.nestedSteps,
    emissions: rt.emissions,
  };
}

type WriteAttempt = {
  settled: readonly Signal[];
  retryable: boolean;
};

export const deadlockSqlState = "40P01";

export const serializationSqlState = "40001";

export function isRetryableSqlState(codes: readonly string[]): boolean {
  for (const code of codes) {
    if (code === deadlockSqlState) {
      return true;
    }
    if (code === serializationSqlState) {
      return true;
    }
    return false;
  }
  return false;
}

export function isRetryableWriteError(err: CaughtFailure): boolean {
  const codes = sqlStateOf(err);
  if (codes.length < 1) {
    return false;
  }
  if (codes.length > 1) {
    throw ValidationError.create("a driver error carries one sql state");
  }
  return isRetryableSqlState(codes);
}

function backoffPause(attempt: number): Promise<void> {
  if (Number.isInteger(attempt) === false) {
    throw ValidationError.create("write attempt must be an integer");
  }
  if (attempt < 1) {
    throw ValidationError.create("write attempt must be positive");
  }
  const waited = writeRetryBackoffMs * attempt;
  if (waited < 1) {
    throw ValidationError.create("write retry backoff must be positive");
  }
  return new Promise<void>((resolve) => setTimeout(resolve, waited));
}

function attemptSeq(): readonly number[] {
  let attempts: readonly number[] = [];
  for (let attempt = 1; attempt <= maxWriteAttempts; attempt = attempt + 1) {
    attempts = appendItem(attempts, attempt);
  }
  if (attempts.length !== maxWriteAttempts) {
    throw ValidationError.create("write attempt sequence must match the budget");
  }
  return attempts;
}

function retryableFailure(err: CaughtFailure, txRt: Runtime): boolean {
  if (isRetryableWriteError(err) === true) {
    return true;
  }
  if (isRetryableSqlState(txRt.store.lastSqlState()) === true) {
    return true;
  }
  return false;
}

async function attemptWrite(
  rt: Runtime,
  run: (txRt: Runtime) => Promise<Signal>,
  lastChance: boolean,
): Promise<WriteAttempt> {
  let client: PgClient;
  try {
    client = await rt.pool.connect();
  } catch (err) {
    rt.reportDbError(dbErrorMessageForLog(err, "database unavailable"));
    return { settled: [Failed], retryable: false };
  }
  const txRt: Runtime = transactionRuntime(rt, client);
  let committed = false;
  let signal: Signal = Failed;
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL lock_timeout = ${lockTimeoutMs}`);
    signal = await run(txRt);
    if (signal === Failed) {
      clearPendingWork(txRt);
      await client.query("ROLLBACK");
      if (lastChance === false && isRetryableSqlState(txRt.store.lastSqlState()) === true) {
        return { settled: [], retryable: true };
      }
    } else {
      if (signal === Running) {
        const cleared = await discardUncommittedCreates(txRt);
        if (cleared === false) {
          clearPendingWork(txRt);
          await client.query("ROLLBACK");
          return { settled: [Failed], retryable: false };
        }
        txRt.pendingEntityWrites.rows = [];
      }
      await client.query("COMMIT");
      committed = true;
      flushPendingEntityWrites(txRt);
      const flushed = await flushPendingExternalEvents(txRt);
      if (flushed === false && signal === Running) {
        return { settled: [Failed], retryable: false };
      }
    }
    return { settled: [signal], retryable: false };
  } catch (err) {
    if (committed === true) {
      return { settled: [signal], retryable: false };
    }
    const retryable = lastChance === false && retryableFailure(err, txRt) === true;
    if (retryable === false) {
      rt.reportDbError(dbErrorMessageForLog(err, "database unavailable"));
    }
    try {
      clearPendingWork(txRt);
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      rt.reportDbError(dbErrorMessageForLog(rollbackErr, "database unavailable"));
      return { settled: [Failed], retryable: false };
    }
    if (retryable === true) {
      return { settled: [], retryable: true };
    }
    return { settled: [Failed], retryable: false };
  } finally {
    client.release();
  }
}

async function discardUncommittedCreates(txRt: Runtime): Promise<boolean> {
  let removed = 0;
  for (const write of txRt.pendingEntityWrites.rows) {
    if (write.created === false) {
      continue;
    }
    const dropped = await txRt.store.removeEntityRow(txRt.models, write.model, write.entityId);
    if (dropped === false) {
      return false;
    }
    removed = removed + 1;
  }
  if (removed > txRt.pendingEntityWrites.rows.length) {
    throw ValidationError.create("removed more rows than were written");
  }
  return true;
}

export async function withWriteTransaction(
  rt: Runtime,
  run: (txRt: Runtime) => Promise<Signal>,
): Promise<Signal> {
  for (const attempt of attemptSeq()) {
    const outcome = await attemptWrite(rt, run, attempt >= maxWriteAttempts);
    for (const signal of outcome.settled) {
      return signal;
    }
    if (outcome.retryable === false) {
      return Failed;
    }
    rt.clearDbError();
    await backoffPause(attempt);
  }
  return Failed;
}

export function emptyFilterInput(): FilterInput {
  const filter: FilterInput = {};
  const probe = z.record(z.string(), z.object({}).partial()).safeParse(filter);
  if (probe.success === false) {
    throw ValidationError.create("empty filter invalid");
  }
  if (Object.keys(filter).length > 0) {
    throw ValidationError.create("empty filter invalid");
  }
  return filter;
}

export function resolveModel(rt: Runtime, target: ModelRef): readonly ModelDef<ModelFieldsInput>[] {
  if (z.looseObject({}).safeParse(rt).success === false) {
    throw ValidationError.create("runtime required");
  }
  if (z.string().min(1).safeParse(target.name).success === false) {
    throw ValidationError.create("model name required");
  }
  for (const model of rt.models) {
    if (model.name === target.name) {
      return [model];
    }
  }
  return [];
}

export function requireModel(
  hits: readonly ModelDef<ModelFieldsInput>[],
  message: string,
): ModelDef<ModelFieldsInput> {
  for (const hit of hits) {
    if (z.string().min(1).safeParse(message).success === false) {
      throw ValidationError.create("model message required");
    }
    return hit;
  }
  throw ValidationError.create(message);
}

export function runtimeOf(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  operation: string,
  store: PostgresStore,
  parent: readonly RuntimeParent[] = [],
): Runtime {
  return {
    traceId: rt.traceId,
    model,
    entityId,
    operation,
    parent,
    rooms: rt.rooms,
    obs: rt.obs,
    outbox: rt.outbox,
    onExternalEvent: rt.onExternalEvent,
    models: rt.models,
    externals: rt.externals,
    resume: rt.resume,
    entities: rt.entities,
    pool: rt.pool,
    store,
    awaitDb: rt.awaitDb,
    reportDbError: rt.reportDbError,
    clearDbError: rt.clearDbError,
    dbLastError: rt.dbLastError,
    pendingExternalEvents: rt.pendingExternalEvents,
    pendingEntityWrites: rt.pendingEntityWrites,
    nestedSteps: rt.nestedSteps,
    emissions: rt.emissions,
  };
}

function descentParent(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
): readonly RuntimeParent[] {
  if (rt.model.name === model.name && rt.entityId === entityId) {
    return rt.parent;
  }
  if (z.string().min(1).safeParse(rt.entityId).success === false) {
    return rt.parent;
  }
  return [{ model: rt.model.name, entityId: rt.entityId }];
}

export function scopedRuntime(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  operation: string,
): Runtime {
  if (z.string().min(1).safeParse(entityId).success === false) {
    throw ValidationError.create("scoped runtime entity id required");
  }
  if (z.string().min(1).safeParse(operation).success === false) {
    throw ValidationError.create("scoped runtime operation required");
  }
  const next = runtimeOf(
    rt,
    model,
    entityId,
    operation,
    rt.store,
    descentParent(rt, model, entityId),
  );
  return next;
}
