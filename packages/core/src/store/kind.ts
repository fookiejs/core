import type { ModelDef, ModelFieldsInput } from "../model.ts";
import { appendItem } from "../slot.ts";
import type { Database } from "./database.ts";

export function storeKindOf(database: Database): string {
  return database.kind;
}

export function modelDatabaseOf(model: ModelDef<ModelFieldsInput>, fallback: Database): Database {
  for (const pinned of model.database) {
    return pinned;
  }
  return fallback;
}

export function sameStore(
  left: ModelDef<ModelFieldsInput>,
  right: ModelDef<ModelFieldsInput>,
  fallback: Database,
): boolean {
  return modelDatabaseOf(left, fallback).key === modelDatabaseOf(right, fallback).key;
}

export function collectDatabases(
  models: readonly ModelDef<ModelFieldsInput>[],
  fallback: Database,
): readonly Database[] {
  let engines: readonly Database[] = [fallback];
  let keys: readonly string[] = [fallback.key];
  for (const model of models) {
    const engine = modelDatabaseOf(model, fallback);
    if (keys.includes(engine.key) === true) {
      continue;
    }
    keys = appendItem(keys, engine.key);
    engines = appendItem(engines, engine);
  }
  return engines;
}
