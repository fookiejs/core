import { z } from "zod";
import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  Done,
  External,
  Failed,
  Model,
  OutboxCompleted,
  OutboxFailed,
  OutboxPending,
  app,
} from "../src/index.ts";
import { MockDb } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const retryExt = External({
  name: "retry.score",
  input: { amount: z.number().finite().nonnegative() },
  output: { score: z.number().int() },
  attempts: 2,
  backoff: "exponential",
  timeoutMs: 30_000,
});

describe("saga edge behaviour", () => {
  let db: MockDb;

  beforeEach(() => {
    db = new MockDb();
  });

  it("retries with exponential backoff on invalid external output", async () => {
    const user = Model({
      name: "ExpoUser",
      fields: { email: z.string().email() },
      flow: {
        async create(flow) {
          const result = await flow.external(retryExt, { amount: 5 });
          return result.signal === "done" ? Done : result.signal;
        },
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      },
    });

    let dispatched = 0;
    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [user],
      externals: [retryExt] as const,
      onExternalEvent: async () => {
        dispatched += 1;
      },
    });

    const pending = await fookie.create(user, { email: "e@x.com" });
    assert.equal(pending.signal, "running");
    const entry = [...db.outbox.keys()][0];
    assert.ok(entry !== undefined);

    await fookie.setExternalResult({ externalId: entry, output: { score: "bad" } });
    assert.equal(dispatched, 2);
    assert.equal(
      fookie.metrics().some((metric) => metric.name === "expouser.external.retry"),
      true,
    );
  });

  it("skips re-dispatch when the stored outbox input no longer validates", async () => {
    const user = Model({
      name: "StaleInput",
      fields: { email: z.string().email() },
      flow: {
        create: async () => Done,
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      },
    });

    db.outbox.set("stale", {
      external_id: "stale",
      name: "retry.score",
      status: OutboxPending,
      input: { amount: -5 },
      output: null,
      entity_id: "e1",
      model: "StaleInput",
      run_id: "r1",
      attempt: 1,
    });

    let dispatched = 0;
    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [user],
      externals: [retryExt] as const,
      onExternalEvent: async () => {
        dispatched += 1;
      },
    });

    const created = await fookie.create(user, { email: "s@x.com" });
    assert.equal(created.signal, "done");

    const retried = await fookie.setExternalResult({
      externalId: "stale",
      output: { score: "bad" },
    });
    assert.equal(retried, false);
    assert.equal(dispatched, 0);
  });

  it("fails nested update and delete on a missing child", async () => {
    const child = Model({
      name: "GoneChild",
      fields: { title: z.string() },
      flow: {
        create: async () => Done,
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      },
    });

    const parent = Model({
      name: "GoneParent",
      fields: { email: z.string().email() },
      flow: {
        create: async () => Done,
        list: async () => Done,
        async update(flow) {
          const missing = await flow.update(
            child,
            { id: { eq: "00000000-0000-7000-8000-00000000dead" } },
            { title: "x" },
          );
          return missing.signal === "done" ? Done : Failed;
        },
        async delete(flow) {
          const missing = await flow.delete(child, {
            id: "00000000-0000-7000-8000-00000000dead",
            filter: {},
          });
          return missing.signal === "failed" ? Failed : Done;
        },
      },
    });

    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [child, parent],
      externals: [retryExt] as const,
      onExternalEvent: async () => {},
    });

    const created = await fookie.create(parent, { email: "g@p.com" });
    assert.equal(created.signal, "done");
    if (created.signal !== "done") {
      return;
    }
    assert.equal(
      (await fookie.update(parent, { id: { eq: created.id } }, {})).signal,
      "done",
    );
    assert.equal((await fookie.delete(parent, { id: created.id, filter: {} })).signal, "failed");
  });

  it("rolls back the saga when a nested flow throws", async () => {
    const child = Model({
      name: "ThrowChild",
      fields: { title: z.string() },
      flow: {
        async create() {
          throw new Error("boom");
        },
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      },
    });

    const parent = Model({
      name: "ThrowParent",
      fields: { email: z.string().email() },
      flow: {
        async create(flow) {
          const nested = await flow.create(child, { title: "t" });
          return nested.signal === "done" ? Done : Failed;
        },
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      },
    });

    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [child, parent],
      externals: [retryExt] as const,
      onExternalEvent: async () => {},
    });

    const created = await fookie.create(parent, { email: "t@p.com" });
    assert.equal(created.signal, "failed");
  });

  it("caps observability buffers at the retention limit", async () => {
    const user = Model({
      name: "Chatty",
      fields: { email: z.string().email() },
      flow: {
        async create(flow) {
          for (let i = 0; i < 10_001; i += 1) {
            flow.log("chatter", { seq: i });
          }
          return Done;
        },
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      },
    });

    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [user],
      externals: [retryExt] as const,
      onExternalEvent: async () => {},
    });

    const silenced = mock.method(process.stdout, "write", () => true);
    const created = await fookie.create(user, { email: "c@x.com" });
    silenced.mock.restore();
    assert.equal(created.signal, "done");
    assert.ok(fookie.logs().length <= 10_000);
    assert.ok(fookie.logs().length > 0);
    assert.equal(
      fookie.logs().some((entry) => entry.message === "chatter"),
      true,
    );
  });
});
