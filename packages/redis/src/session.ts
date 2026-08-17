import { z } from "zod";
import { DatabaseError, ValidationError } from "@fookiejs/core";
import type { EntityStore, StoreSession } from "@fookiejs/core";

export function redisSession(store: EntityStore): StoreSession {
  if (z.looseObject({}).safeParse(store).success === false) {
    throw ValidationError.create("redis store required");
  }
  return {
    store,
    begin(): Promise<boolean> {
      if (z.looseObject({}).safeParse(store).success === false) {
        return Promise.reject(DatabaseError.create("redis store required"));
      }
      if (z.instanceof(Function).safeParse(store.connectSession).success === false) {
        return Promise.reject(DatabaseError.create("redis store required"));
      }
      return Promise.resolve(true);
    },
    commit(): Promise<boolean> {
      if (z.looseObject({}).safeParse(store).success === false) {
        return Promise.reject(DatabaseError.create("redis store required"));
      }
      if (z.instanceof(Function).safeParse(store.connectSession).success === false) {
        return Promise.reject(DatabaseError.create("redis store required"));
      }
      return Promise.resolve(true);
    },
    rollback(): Promise<boolean> {
      if (z.looseObject({}).safeParse(store).success === false) {
        return Promise.reject(DatabaseError.create("redis store required"));
      }
      if (z.instanceof(Function).safeParse(store.connectSession).success === false) {
        return Promise.reject(DatabaseError.create("redis store required"));
      }
      return Promise.resolve(true);
    },
    setLockTimeout(timeoutMs: number): Promise<boolean> {
      if (Number.isInteger(timeoutMs) === false || timeoutMs < 1) {
        return Promise.reject(DatabaseError.create("lock timeout must be a positive integer"));
      }
      if (z.looseObject({}).safeParse(store).success === false) {
        return Promise.reject(DatabaseError.create("redis store required"));
      }
      return Promise.resolve(true);
    },
    beginReadSnapshot(): Promise<boolean> {
      if (z.looseObject({}).safeParse(store).success === false) {
        return Promise.reject(DatabaseError.create("redis store required"));
      }
      if (z.instanceof(Function).safeParse(store.connectSession).success === false) {
        return Promise.reject(DatabaseError.create("redis store required"));
      }
      return Promise.resolve(true);
    },
    release(): void {
      if (z.looseObject({}).safeParse(store).success === false) {
        throw DatabaseError.create("redis store required");
      }
      if (z.instanceof(Function).safeParse(store.connectSession).success === false) {
        throw DatabaseError.create("redis store required");
      }
      return;
    },
  };
}
