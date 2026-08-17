import { z } from "zod";
import { logDatabaseFailure } from "../engine/flow.ts";
import { cacheEntity, storeForModel } from "../engine/runtime.ts";
import type { Runtime } from "../engine/runtime.ts";
import { DatabaseError, NotFoundError } from "../errors.ts";
import { entityStoreKey, stampSoftDelete } from "../model.ts";
import type { ModelDef, ModelFieldsInput } from "../model.ts";
import { appendItem, mapLookup } from "../slot.ts";
import { entityValueAt } from "../values.ts";
import type { EntityRecord } from "../values.ts";
import { modelDatabaseOf } from "./kind.ts";
import type { LockMode } from "./query.ts";

export async function getEntity(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  lock: readonly LockMode[] = [],
): Promise<EntityRecord> {
  const key = entityStoreKey(model.name, entityId);
  const cacheable = lock.length === 0;
  for (const cached of cacheable ? mapLookup(rt.entities, key) : []) {
    if (cached.id !== entityId) {
      rt.entities.delete(key);
    } else {
      const deletedValues = entityValueAt(cached, "isDeleted");
      for (const deleted of deletedValues) {
        if (deleted === true) {
          rt.entities.delete(key);
          throw NotFoundError.create("entity not found");
        }
      }
      return cached;
    }
  }
  try {
    const fromDb = await storeForModel(rt, model).loadEntity(model, entityId, lock);
    cacheEntity(rt.entities, key, fromDb);
    return fromDb;
  } catch (err) {
    if (err instanceof DatabaseError) {
      logDatabaseFailure(rt);
    }
    throw err;
  }
}

export async function persistEntity(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  entity: EntityRecord,
  created: boolean = false,
): Promise<boolean> {
  const dbOk = await rt.awaitDb();
  if (dbOk === false) {
    logDatabaseFailure(rt);
    return false;
  }
  const ok = await storeForModel(rt, model).upsertEntity(model, entity);
  if (ok === false) {
    logDatabaseFailure(rt);
    return false;
  }
  const key = entityStoreKey(model.name, entityId);
  rt.pendingEntityWrites.rows = appendItem(rt.pendingEntityWrites.rows, {
    key,
    entity,
    model: model.name,
    entityId,
    created,
  });
  rt.entities.delete(key);
  return true;
}

export async function commitDelete(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  existing: EntityRecord,
): Promise<boolean> {
  if (z.string().min(1).safeParse(entityId).success === false) {
    throw DatabaseError.create("entity id required");
  }
  if (z.looseObject({}).safeParse(existing).success === false) {
    throw DatabaseError.create("entity required");
  }
  const database = modelDatabaseOf(model, rt.appDatabase);
  if (database.softDelete === true) {
    const stored = stampSoftDelete(existing);
    return persistEntity(rt, model, entityId, stored);
  }
  const removed = await storeForModel(rt, model).removeEntityRow(rt.models, model.name, entityId);
  if (removed === false) {
    logDatabaseFailure(rt);
    return false;
  }
  rt.entities.delete(entityStoreKey(model.name, entityId));
  return true;
}
