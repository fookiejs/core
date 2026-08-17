import { z } from "zod";
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, External, Model, app } from "../src/index.ts";
import { MockDb, LiveApps } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const audit = External({
  name: "mutation.audit",
  input: { note: z.string() },
  output: { logged: z.boolean() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const doc = Model({
  name: "MutDoc",
  fields: { title: z.string() },
  flow: {
    async create() {
      return Done;
    },
    async list() {
      return Done;
    },
    async update(flow) {
      const result = await flow.external(audit, { note: "updated" });
      return result.signal;
    },
    async delete(flow) {
      const result = await flow.external(audit, { note: "deleted" });
      return result.signal;
    },
  },
});

describe("update and delete join the saga", () => {
  let db: MockDb;
  let apps: LiveApps;
  let port: number;

  beforeEach(() => {
    db = new MockDb();
    apps = new LiveApps();
    port = 22500 + Math.floor(Math.random() * 400);
  });

  function boot() {
    return apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [doc],
        externals: [audit] as const,
        onExternalEvent: async () => {},
      }),
    );
  }

  it("hands back a runId that resolves the suspended update", async () => {
    const fookie = boot();
    const created = await fookie.create(doc, { title: "t" });
    assert.equal(created.signal, "done");
    if (created.signal !== "done") {
      return;
    }

    const updated = await fookie.update(doc, { id: { eq: created.id } }, { title: "t2" });
    assert.equal(updated.signal, "running");
    assert.equal(updated.ids.length, 0);

    const stored = await fookie.sagaRun(updated.runId);
    assert.equal(stored.length, 1);
    for (const row of stored) {
      assert.equal(row.operation, "update");
      assert.equal(row.entityId, updated.runId);
    }

    const pending = [...db.outbox.values()];
    assert.equal(pending.length, 1);
    for (const row of pending) {
      assert.equal(row.run_id, updated.runId);
      const accepted = await fookie.setExternalResult({
        externalId: String(row.external_id),
        output: { logged: true },
      });
      assert.equal(accepted, true);
    }
    await apps.shutdown();
  });

  it("carries the same shape through delete", async () => {
    const fookie = boot();
    const created = await fookie.create(doc, { title: "d" });
    if (created.signal !== "done") {
      return;
    }

    const removed = await fookie.delete(doc, { id: created.id, filter: {} });
    assert.equal(removed.signal, "running");
    assert.equal(removed.id, created.id);
    assert.notEqual(removed.runId, created.runId);
    await apps.shutdown();
  });
});
