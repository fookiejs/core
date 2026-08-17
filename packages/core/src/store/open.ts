import { DatabaseError } from "../errors.ts";
import type { ModelDef, ModelFieldsInput } from "../model.ts";
import { appendItem, mapLookup } from "../slot.ts";
import type { Database, StoreBinding } from "./database.ts";
import type { EntityStore } from "./entity-store.ts";
import { collectDatabases } from "./kind.ts";
import type { StoreDbErrorHandler } from "./query.ts";

export type { StoreBinding } from "./database.ts";

export function openBinding(
  database: Database,
  onDbError: readonly StoreDbErrorHandler[],
): StoreBinding {
  return database.open({
    onDbError,
  });
}

export class StoreRegistry {
  private readonly bindings = new Map<string, StoreBinding>();

  private constructor() {}

  static open(
    models: readonly ModelDef<ModelFieldsInput>[],
    fallback: Database,
    onDbError: readonly StoreDbErrorHandler[],
  ): StoreRegistry {
    const registry = new StoreRegistry();
    const engines = collectDatabases(models, fallback);
    for (const engine of engines) {
      registry.bindings.set(engine.key, openBinding(engine, onDbError));
    }
    return registry;
  }

  lookup(database: string): readonly StoreBinding[] {
    return mapLookup(this.bindings, database);
  }

  require(database: string): StoreBinding {
    for (const hit of this.lookup(database)) {
      return hit;
    }
    throw DatabaseError.create("database is not open");
  }

  all(): readonly StoreBinding[] {
    if (this.bindings.size < 1) {
      throw DatabaseError.create("store registry is empty");
    }
    let list: readonly StoreBinding[] = [];
    for (const binding of this.bindings.values()) {
      list = appendItem(list, binding);
    }
    return list;
  }

  defaultStore(fallback: Database): EntityStore {
    return this.require(fallback.key).store;
  }
}
