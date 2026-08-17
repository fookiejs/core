import { ValidationError } from "@fookiejs/core";
import type { Database, OpenContext, StoreBinding } from "@fookiejs/core";
import { requireInjectedPool, wrapOwnedPool } from "./pool.ts";
import type { InjectablePool } from "./pool.ts";
import { PostgresStore } from "./store.ts";

export type StoreRetention = {
  softDelete: boolean;
};

function openPostgres(
  url: string,
  context: OpenContext,
  injected: readonly InjectablePool[],
): StoreBinding {
  if (injected.length > 0) {
    const pool = requireInjectedPool(injected);
    return {
      database: url,
      store: PostgresStore.create(pool, context.onDbError, [pool]),
      close: [],
    };
  }
  const pool = wrapOwnedPool(url);
  return {
    database: url,
    store: PostgresStore.create(pool, context.onDbError, [pool]),
    close: pool.end,
  };
}

export function Postgres(
  url: string,
  injected: readonly InjectablePool[] = [],
  retention: StoreRetention = { softDelete: true },
): Database {
  if (url.length < 1) {
    throw ValidationError.create("database required");
  }
  if (url.startsWith("postgres://") === false && url.startsWith("postgresql://") === false) {
    throw ValidationError.create("database protocol unsupported");
  }
  return {
    key: url,
    kind: "postgres",
    softDelete: retention.softDelete,
    open(context: OpenContext): StoreBinding {
      return openPostgres(url, context, injected);
    },
  };
}

export type { InjectablePool, PgClient, PgQueryable, PgQueryResult } from "./pool.ts";
export { requireInjectedPool, wrapOwnedPool } from "./pool.ts";
export { PostgresStore } from "./store.ts";
export { modelForeignKeyStatements, schemaVersion, schemaVersionStatements } from "./ddl.ts";
export { NotifyBus, settledChannel } from "./notify-bus.ts";
export type { NotifyBusOptions } from "./notify-bus.ts";
