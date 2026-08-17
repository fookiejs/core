import { z } from "zod";
import { DatabaseError } from "@fookiejs/core";
import { snapshotIdleTimeoutMs, snapshotStatementTimeoutMs } from "@fookiejs/core";
import type { PgClient } from "./pool.ts";
import type { EntityStore, StoreSession } from "@fookiejs/core";

export function postgresSession(client: PgClient, store: EntityStore): StoreSession {
  if (z.instanceof(Function).safeParse(client.query).success === false) {
    throw DatabaseError.create("session client required");
  }
  if (z.instanceof(Function).safeParse(client.release).success === false) {
    throw DatabaseError.create("session release required");
  }
  return {
    store,
    async begin(): Promise<boolean> {
      if (z.instanceof(Function).safeParse(client.query).success === false) {
        throw DatabaseError.create("session client required");
      }
      const begun = await client.query(
        "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ",
      );
      if (z.looseObject({}).safeParse(begun).success === false) {
        throw DatabaseError.create("begin failed");
      }
      return true;
    },
    async commit(): Promise<boolean> {
      if (z.instanceof(Function).safeParse(client.query).success === false) {
        throw DatabaseError.create("session client required");
      }
      const committed = await client.query("COMMIT");
      if (z.looseObject({}).safeParse(committed).success === false) {
        throw DatabaseError.create("commit failed");
      }
      return true;
    },
    async rollback(): Promise<boolean> {
      if (z.instanceof(Function).safeParse(client.query).success === false) {
        throw DatabaseError.create("session client required");
      }
      const rolled = await client.query("ROLLBACK");
      if (z.looseObject({}).safeParse(rolled).success === false) {
        throw DatabaseError.create("rollback failed");
      }
      return true;
    },
    async setLockTimeout(timeoutMs: number): Promise<boolean> {
      if (Number.isInteger(timeoutMs) === false || timeoutMs < 1) {
        throw DatabaseError.create("lock timeout must be a positive integer");
      }
      if (z.instanceof(Function).safeParse(client.query).success === false) {
        throw DatabaseError.create("session client required");
      }
      await client.query(`SET LOCAL lock_timeout = ${timeoutMs}`);
      return true;
    },
    async beginReadSnapshot(): Promise<boolean> {
      if (z.instanceof(Function).safeParse(client.query).success === false) {
        throw DatabaseError.create("session client required");
      }
      const begun = await client.query(
        "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      if (z.looseObject({}).safeParse(begun).success === false) {
        throw DatabaseError.create("snapshot begin failed");
      }
      await client.query(`SET LOCAL statement_timeout = ${snapshotStatementTimeoutMs}`);
      await client.query(
        `SET LOCAL idle_in_transaction_session_timeout = ${snapshotIdleTimeoutMs}`,
      );
      return true;
    },
    release(): void {
      if (z.instanceof(Function).safeParse(client.release).success === false) {
        throw DatabaseError.create("session release required");
      }
      client.release();
      if (z.instanceof(Function).safeParse(client.release).success === false) {
        throw DatabaseError.create("session release required");
      }
    },
  };
}
