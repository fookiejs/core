import { z } from "zod";
import pg from "pg";
import { ValidationError } from "../errors.ts";
import type { PgParam } from "./encode.ts";

export type PgQueryResult = {
  rows: readonly pg.QueryResultRow[];
};

export type PgQueryable = {
  query: (sql: string, params?: PgParam[]) => Promise<PgQueryResult>;
};

export type PgClient = PgQueryable & { release: () => void };

export type InjectablePool = PgQueryable & {
  connect: () => Promise<PgClient>;
  end: readonly (() => Promise<void>)[];
};

export function wrapOwnedPool(connectionString: string): InjectablePool {
  if (z.string().min(1).safeParse(connectionString).success === false) {
    throw ValidationError.create("database connection string required");
  }
  const rawPool = new pg.Pool({ connectionString });
  const closePool = () => rawPool.end();
  return {
    query: rawPool.query.bind(rawPool),
    connect: () => rawPool.connect(),
    end: [closePool],
  };
}

export function requireInjectedPool(pools: readonly InjectablePool[]): InjectablePool {
  for (const pool of pools) {
    if (z.looseObject({}).safeParse(pool).success === false) {
      throw ValidationError.create("injected pool invalid");
    }
    return pool;
  }
  throw ValidationError.create("injected pool required");
}
