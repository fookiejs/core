import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { app, Done, Failed, External, flows, Model, Types, OutboxPending, OutboxFailed, OutboxCompleted } from "../src/index.ts";
import { MockDb } from "./mock-db.ts";

const retryExt = External({
  name: "retry.score",
  input: { amount: Types.currency },
  output: { score: Types.int },
  attempts: 2,
  backoff: "exponential",
});

describe("saga edge behaviour", () => {
  let db: MockDb;

  beforeEach(() => {
    db = new MockDb();
  });

  it("retries with exponential backoff on invalid external output", async () => {
    const user = Model({
      name: "ExpoUser",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const result = await flow.external(retryExt, { amount: 5 });
          return result.signal === "done" ? Done : result.signal;
        },
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
    });

    let dispatched = 0;
    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [user],
      externals: [retryExt] as const,
      onExternalEvent: async () => {
        dispatched += 1;
      },
      pool: [db],
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
      fields: { email: Types.email },
      flow: flows({
        create: async () => Done,
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
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
      database: "postgres://mock",
      models: [user],
      externals: [retryExt] as const,
      onExternalEvent: async () => {
        dispatched += 1;
      },
      pool: [db],
    });

    const created = await fookie.create(user, { email: "s@x.com" });
    assert.equal(created.signal, "done");

    const retried = await fookie.setExternalResult({ externalId: "stale", output: { score: "bad" } });
    assert.equal(retried, false);
    assert.equal(dispatched, 0);
  });

  it("fails nested update and delete on a missing child", async () => {
    const child = Model({
      name: "GoneChild",
      fields: { title: Types.string },
      flow: flows({
        create: async () => Done,
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
    });

    const parent = Model({
      name: "GoneParent",
      fields: { email: Types.email },
      flow: flows({
        create: async () => Done,
        list: async () => Done,
        async update(flow) {
          const missing = await flow.update(child, {
            id: "00000000-0000-7000-8000-00000000dead",
            body: { title: "x" },
            filter: {},
          });
          return missing.signal === "failed" ? Failed : Done;
        },
        async delete(flow) {
          const missing = await flow.delete(child, {
            id: "00000000-0000-7000-8000-00000000dead",
            filter: {},
          });
          return missing.signal === "failed" ? Failed : Done;
        },
      }),
    });

    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [child, parent],
      externals: [retryExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });

    const created = await fookie.create(parent, { email: "g@p.com" });
    assert.equal(created.signal, "done");
    if (created.signal !== "done") {
      return;
    }
    assert.equal(await fookie.update(parent, { id: created.id, body: {}, filter: {} }), "failed");
    assert.equal(await fookie.delete(parent, { id: created.id, filter: {} }), "failed");
  });

  it("rolls back the saga when a nested flow throws", async () => {
    const child = Model({
      name: "ThrowChild",
      fields: { title: Types.string },
      flow: flows({
        async create() {
          throw new Error("boom");
        },
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
    });

    const parent = Model({
      name: "ThrowParent",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const nested = await flow.create(child, { title: "t" });
          return nested.signal === "done" ? Done : Failed;
        },
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
    });

    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [child, parent],
      externals: [retryExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });

    const created = await fookie.create(parent, { email: "t@p.com" });
    assert.equal(created.signal, "failed");
  });

  it("caps observability buffers at the retention limit", async () => {
    const user = Model({
      name: "Chatty",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          for (let i = 0; i < 10_001; i += 1) {
            flow.log("chatter", { seq: i });
          }
          return Done;
        },
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
    });

    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [user],
      externals: [retryExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });

    const silenced = mock.method(process.stdout, "write", () => true);
    const created = await fookie.create(user, { email: "c@x.com" });
    silenced.mock.restore();
    assert.equal(created.signal, "done");
    assert.equal(fookie.logs().length, 10_000);
    assert.equal(
      fookie.logs().some((entry) => entry.message === "chatter"),
      true,
    );
  });
});
