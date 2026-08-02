import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, app } from "../src/index.ts";
import { maxWriteAttempts } from "../src/observability.ts";
import { isRetryableSqlState, isRetryableWriteError } from "../src/engine/runtime.ts";
import { MockDb } from "./mock-db.ts";

const ledger = Model({
  name: "RetryLedger",
  fields: { amount: z.number().int() },
  flow: {
    async create() {
      return Done;
    },
    async list() {
      return Done;
    },
    async update() {
      return Done;
    },
    async delete() {
      return Done;
    },
  },
});

function boot(db: MockDb) {
  return app({
    listen: "0",
    database: "postgres://mock",
    models: [ledger],
    externals: [] as const,
    onExternalEvent: async () => {},
    pool: [db],
  });
}

function beginCount(queries: readonly string[]): number {
  let seen = 0;
  for (const sql of queries) {
    if (sql === "BEGIN") {
      seen = seen + 1;
    }
  }
  return seen;
}

describe("write retry", () => {
  it("names only the two states a retry can fix", () => {
    assert.equal(isRetryableSqlState(["40P01"]), true, "deadlock detected");
    assert.equal(isRetryableSqlState(["40001"]), true, "serialization failure");
    assert.equal(isRetryableSqlState(["55P03"]), false, "a lock timeout must fail fast");
    assert.equal(isRetryableSqlState(["23505"]), false, "a duplicate key is the caller's problem");
    assert.equal(isRetryableSqlState([]), false, "an error with no state is not retryable");
  });

  it("reads the state off a driver error and ignores anything else", () => {
    const deadlock: Error & { code?: string } = new Error("deadlock detected");
    deadlock.code = "40P01";
    assert.equal(isRetryableWriteError(deadlock), true);
    assert.equal(isRetryableWriteError(new Error("deadlock detected")), false);
    assert.equal(isRetryableWriteError("deadlock detected"), false);
  });

  it("commits after a deadlock that clears on the second attempt", async () => {
    const db = new MockDb();
    const writer = boot(db);
    const created = await writer.create(ledger, { amount: 1 });
    assert.equal(created.signal, "done");
    if (created.signal !== "done") {
      throw new Error("ledger row required");
    }

    db.queries = [];
    db.failCode = "40P01";
    db.failBudget = 1;
    db.failOnSql = "INSERT INTO public.retry_ledger";

    const second = await writer.create(ledger, { amount: 2 });
    assert.equal(second.signal, "done", "the retry must carry the write through");
    assert.equal(beginCount(db.queries), 2, "exactly one retry, not a loop");

    await writer.stop();
  });

  it("gives up on a deadlock that never clears", async () => {
    const db = new MockDb();
    const writer = boot(db);
    const created = await writer.create(ledger, { amount: 1 });
    assert.equal(created.signal, "done");

    db.queries = [];
    db.failCode = "40P01";
    db.failBudget = -1;
    db.failOnSql = "INSERT INTO public.retry_ledger";

    const doomed = await writer.create(ledger, { amount: 2 });
    assert.equal(doomed.signal, "failed", "a permanent deadlock must still settle");
    assert.equal(
      beginCount(db.queries),
      maxWriteAttempts,
      "the budget is the ceiling, not a suggestion",
    );

    await writer.stop();
  });

  it("does not retry a failure the database will raise again", async () => {
    const db = new MockDb();
    const writer = boot(db);
    const created = await writer.create(ledger, { amount: 1 });
    assert.equal(created.signal, "done");

    db.queries = [];
    db.failCode = "23505";
    db.failBudget = -1;
    db.failOnSql = "INSERT INTO public.retry_ledger";

    const rejected = await writer.create(ledger, { amount: 2 });
    assert.equal(rejected.signal, "failed");
    assert.equal(beginCount(db.queries), 1, "a duplicate key must not be attempted again");

    await writer.stop();
  });
});
