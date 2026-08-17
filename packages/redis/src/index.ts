import { ValidationError } from "@fookiejs/core";
import type { Database, OpenContext, StoreBinding } from "@fookiejs/core";
import { requireInjectedRedis, wrapOwnedRedis } from "./driver.ts";
import type { RedisDriver } from "./driver.ts";
import { RedisStore } from "./store.ts";

export type StoreRetention = {
  softDelete: boolean;
};

function openRedis(
  url: string,
  context: OpenContext,
  injected: readonly RedisDriver[],
): StoreBinding {
  if (injected.length > 0) {
    const driver = requireInjectedRedis(injected);
    return {
      database: url,
      store: RedisStore.create(driver, context.onDbError),
      close: [],
    };
  }
  const driver = wrapOwnedRedis(url);
  return {
    database: url,
    store: RedisStore.create(driver, context.onDbError),
    close: driver.end,
  };
}

export function Redis(
  url: string,
  injected: readonly RedisDriver[] = [],
  retention: StoreRetention = { softDelete: true },
): Database {
  if (url.length < 1) {
    throw ValidationError.create("database required");
  }
  if (url.startsWith("redis://") === false && url.startsWith("rediss://") === false) {
    throw ValidationError.create("database protocol unsupported");
  }
  return {
    key: url,
    kind: "redis",
    softDelete: retention.softDelete,
    open(context: OpenContext): StoreBinding {
      return openRedis(url, context, injected);
    },
  };
}

export type { RedisDriver } from "./driver.ts";
export { RedisStore } from "./store.ts";
