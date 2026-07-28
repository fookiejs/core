import { z } from "zod";
import { flushPendingExternalEvents } from "./outbox.ts";
import type { OutboxEntry } from "./outbox.ts";
import { ValidationError } from "../errors.ts";
import type { ExternalDef, ExternalEventOf } from "../external.ts";
import type { FilterInput } from "../filter/schema.ts";
import type { ModelDef, ModelFieldsInput, ModelRef } from "../model.ts";
import { Observability } from "../observability.ts";
import { dbErrorMessageForLog } from "../pg/encode.ts";
import type { InjectablePool, PgClient } from "../pg/pool.ts";
import { PostgresStore } from "../pg/store.ts";
import { Failed, Running } from "../signal.ts";
import type { Signal } from "../signal.ts";
import { appendItem } from "../slot.ts";
import { entityValueAt } from "../values.ts";
import type { EntityRecord } from "../values.ts";

export type PendingExternalEvent = {
  externalId: string;
  name: string;
  input: EntityRecord;
};

export type PendingEntityWrite = {
  key: string;
  entity: EntityRecord;
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

export type Runtime<E extends readonly ExternalDef[] = readonly ExternalDef[]> = {
  traceId: string;
  model: ModelDef<ModelFieldsInput>;
  entityId: string;
  operation: string;
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
};

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
      rt.entities.set(write.key, write.entity);
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
  };
}

export async function withWriteTransaction(
  rt: Runtime,
  run: (txRt: Runtime) => Promise<Signal>,
): Promise<Signal> {
  let client: PgClient;
  try {
    client = await rt.pool.connect();
  } catch (err) {
    rt.reportDbError(dbErrorMessageForLog(err, "database unavailable"));
    return Failed;
  }
  const txRt: Runtime = transactionRuntime(rt, client);
  let committed = false;
  let signal: Signal = Failed;
  try {
    await client.query("BEGIN");
    signal = await run(txRt);
    if (signal === Failed) {
      clearPendingWork(txRt);
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
      committed = true;
      flushPendingEntityWrites(txRt);
      const flushed = await flushPendingExternalEvents(txRt);
      if (flushed === false && signal === Running) {
        return Failed;
      }
    }
    return signal;
  } catch (err) {
    if (committed === true) {
      return signal;
    }
    rt.reportDbError(dbErrorMessageForLog(err, "database unavailable"));
    try {
      clearPendingWork(txRt);
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      rt.reportDbError(dbErrorMessageForLog(rollbackErr, "database unavailable"));
      return Failed;
    }
    return Failed;
  } finally {
    client.release();
  }
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
): Runtime {
  return {
    traceId: rt.traceId,
    model,
    entityId,
    operation,
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
  };
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
  const next = runtimeOf(rt, model, entityId, operation, rt.store);
  return next;
}
