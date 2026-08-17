import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, app } from "../src/index.ts";
import { PostgresStore } from "../../postgresql/src/store.ts";
import { MockDb } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const passthrough = {
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
};

describe("control plane tables", () => {
  it("plants outbox and run only on app.database", async () => {
    const control = new MockDb();
    const models = new MockDb();
    const controlDb = Postgres("postgres://control", [control]);
    const modelDb = Postgres("postgres://models", [models]);
    const ticket = Model({
      name: "ControlTicket",
      database: modelDb,
      fields: { subject: z.string() },
      flow: passthrough,
    });
    const fookie = app({
      listen: "0",
      database: controlDb,
      models: [ticket],
      externals: [],
      onExternalEvent: async () => undefined,
    });
    assert.equal(await fookie.ready(), true);
    assert.equal(control.tables.has("fookie_outbox"), true);
    assert.equal(control.tables.has("fookie_run"), true);
    assert.equal(models.tables.has("fookie_outbox"), false);
    assert.equal(models.tables.has("fookie_run"), false);
    assert.equal(models.tables.has("control_ticket"), true);
    await fookie.stop();
  });

  it("claims each due outbox row once across two workers", async () => {
    const db = new MockDb();
    db.tables.add("fookie_outbox");
    db.tables.add("fookie_run");
    const now = new Date().toISOString();
    db.outbox.set("claim-1", {
      external_id: "claim-1",
      name: "noop",
      status: "pending",
      input: {},
      output: null,
      entity_id: "e1",
      model: "ClaimItem",
      run_id: "r1",
      attempt: 1,
      step_index: 0,
      step: "plain",
      next_attempt_at: now,
      error: null,
      compensation_of: null,
      dispatched_at: now,
    });
    const left = PostgresStore.create(db);
    const right = PostgresStore.create(db);
    const a = await left.claimDueOutbox("worker-a", now, 10);
    const b = await right.claimDueOutbox("worker-b", now, 10);
    assert.equal(a.length, 1);
    assert.equal(a[0]?.externalId, "claim-1");
    assert.equal(b.length, 0);
  });

  it("loads an outbox row by id from control store", async () => {
    const db = new MockDb();
    db.tables.add("fookie_outbox");
    const now = new Date().toISOString();
    db.outbox.set("ext-1", {
      external_id: "ext-1",
      name: "noop",
      status: "pending",
      input: { x: 1 },
      output: null,
      entity_id: "e1",
      model: "Item",
      run_id: "r1",
      attempt: 1,
      step_index: 0,
      step: "plain",
      next_attempt_at: now,
      error: null,
      compensation_of: null,
      dispatched_at: now,
    });
    const store = PostgresStore.create(db);
    const rows = await store.loadOutboxById("ext-1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.externalId, "ext-1");
    assert.equal(rows[0]?.status, "pending");
  });
});
