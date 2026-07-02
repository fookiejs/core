import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { app, Model, External, Types, Done, Running, Failed, flows, models } from "../src/index.ts";
import { MockDb, httpPost, httpGet } from "./mock-db.ts";

let nextPort = 41000;

const scoreExt = External({
  name: "fraud.score",
  input: { amount: Types.currency },
  output: { score: Types.int },
  attempts: 3,
  backoff: "exponential",
});

const notifyExt = External({
  name: "notify.send",
  input: { to: Types.email, body: Types.string },
  output: { sent: Types.bool },
  attempts: 3,
  backoff: "fixed",
});

function buildUserModel(flow: ReturnType<typeof flows>) {
  return Model({
    name: "User",
    fields: {
      email: Types.email.unique(),
      name: Types.string.index(),
      score: Types.int.min(0).max(100),
      location: Types.coordinate,
      meta: Types.jsonb,
    },
    flow,
  });
}

describe("fookie core", () => {
  let db: MockDb;
  let port: number;

  beforeEach(() => {
    db = new MockDb();
    port = nextPort;
    nextPort += 10;
  });

  function createApp(flow: ReturnType<typeof flows>, onExternalEvent = async () => {}) {
    const user = buildUserModel(flow);
    return app({
      listen: String(port),
      database: "postgres://mock",
      models: models(user),
      externals: [scoreExt, notifyExt] as const,
      onExternalEvent,
      pool: db,
    });
  }

  it("creates entity with done signal", async () => {
    const user = buildUserModel(
      flows({
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
      }),
    );
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    const result = await fookie.create(user, {
      email: "a@b.com",
      name: "Ada",
      score: 10,
      location: [1, 2],
      meta: "{}",
    });
    assert.equal(result.signal, "done");
    if (result.signal === "done") {
      assert.equal(result.entity.email, "a@b.com");
      assert.equal(result.entity.isDeleted, false);
    }
  });

  it("returns failed on invalid create body", async () => {
    const user = buildUserModel(
      flows({
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
      }),
    );
    const fookie = createApp(user.flow);
    const result = await fookie.create(user, {
      email: "not-email",
      name: "x",
      score: 1,
      location: [0, 0],
      meta: "{}",
    });
    assert.equal(result.signal, "failed");
  });

  it("runs external flow and resumes with setExternalResult", async () => {
    const events: string[] = [];
    const user = buildUserModel(
      flows({
        async create(flow) {
          const ext = await flow.external(scoreExt, { amount: 50 });
          if (ext.signal === "done") {
            return Done;
          }
          return ext.signal;
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
      }),
    );
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async (event) => {
        events.push(event.externalId);
      },
      pool: db,
    });
    const pending = await fookie.create(user, {
      email: "c@d.com",
      name: "Cal",
      score: 5,
      location: [3, 4],
      meta: "{}",
    });
    assert.equal(pending.signal, "running");
    assert.equal(events.length, 1);
    const externalId = events[0] ?? "";
    const ok = await fookie.setExternalResult({ externalId, output: { score: 99 } });
    assert.equal(ok, true);
    const list = await fookie.list(user, { email: { eq: "c@d.com" } });
    assert.equal(list, "done");
    assert.ok(fookie.listResults().length > 0);
  });

  it("lists updates and deletes entities", async () => {
    const user = buildUserModel(
      flows({
        async create() {
          return Done;
        },
        async list(flow) {
          flow.log("listed", { email: { eq: "l@t.com" } });
          flow.metric.increment("listed");
          await flow.trace("t", async () => true);
          return Done;
        },
        async update() {
          return Done;
        },
        async delete() {
          return Done;
        },
      }),
    );
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    const created = await fookie.create(user, {
      email: "l@t.com",
      name: "List",
      score: 1,
      location: [0, 0],
      meta: "{}",
    });
    assert.equal(created.signal, "done");
    const listSignal = await fookie.list(user, { email: { eq: "l@t.com" } });
    assert.equal(listSignal, "done");
    assert.ok(fookie.listResults().length > 0);
    if (created.signal !== "done") {
      return;
    }
    const updateSignal = await fookie.update(user, {
      id: created.id,
      body: { name: "Listed" },
      filter: { email: { eq: "l@t.com" } },
    });
    assert.equal(updateSignal, "done");
    const deleteSignal = await fookie.delete(user, {
      id: created.id,
      filter: { email: { eq: "l@t.com" } },
    });
    assert.equal(deleteSignal, "done");
    assert.ok(fookie.logs().length > 0);
    assert.ok(fookie.metrics().length > 0);
    assert.ok(fookie.spans().length > 0);
  });

  it("supports nested model operations", async () => {
    const child = Model({
      name: "Post",
      fields: {
        title: Types.string,
        author: Types.relation({ name: "User" }),
      },
      flow: flows({
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
      }),
    });
    const user = buildUserModel(
      flows({
        async create(flow) {
          const nested = await flow.create(child, { title: "Hello", author: flow.id });
          if (nested.signal === "done" && "entity" in nested) {
            return Done;
          }
          return Failed;
        },
        async list(flow) {
          const nested = await flow.list(child, { title: { eq: "Hello" } });
          return nested.signal;
        },
        async update(flow) {
          const nested = await flow.update(child, {
            id: "00000000-0000-7000-8000-000000000001",
            body: { title: "Hi" },
            filter: {},
          });
          return nested.signal;
        },
        async delete(flow) {
          const nested = await flow.delete(child, {
            id: "00000000-0000-7000-8000-000000000001",
            filter: {},
          });
          return nested.signal;
        },
      }),
    );
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user, child],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    const created = await fookie.create(user, {
      email: "n@e.com",
      name: "Nest",
      score: 2,
      location: [1, 1],
      meta: "{}",
    });
    assert.equal(created.signal, "done");
    await fookie.list(user, {});
  });

  it("serves http api", async () => {
    const user = buildUserModel(
      flows({
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
      }),
    );
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    assert.equal(fookie.run(), true);
    assert.equal(fookie.run(), true);
    const created = await httpPost(port, "/user/create", {
      body: { email: "h@t.com", name: "Http", score: 3, location: [1, 2], meta: "{}" },
    });
    assert.equal(created.status, 200);
    assert.equal(created.json.signal, "done");
    const listed = await httpPost(port, "/user/list", { filter: { email: { eq: "h@t.com" } } });
    assert.equal(listed.status, 200);
    const bad = await httpPost(port, "/missing/create", { body: {} });
    assert.equal(bad.status, 404);
    const method = await httpGet(port, "/user/list");
    assert.equal(method, 405);
  });

  it("rolls back failed mutations", async () => {
    const user = buildUserModel(
      flows({
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
      }),
    );
    db.mode = "fail-upsert";
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    const result = await fookie.create(user, {
      email: "r@b.com",
      name: "Rollback",
      score: 1,
      location: [0, 0],
      meta: "{}",
    });
    assert.equal(result.signal, "failed");
  });

  it("hydrates outbox from database on startup", async () => {
    db.outbox.set("e1", {
      external_id: "e1",
      name: "fraud.score",
      status: "completed",
      input: { amount: 1 },
      output: { score: 1 },
      entity_id: "ent",
      model: "User",
      run_id: "run",
    });
    const user = buildUserModel(
      flows({
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
      }),
    );
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    await fookie.list(user, {});
    const ok = await fookie.setExternalResult({ externalId: "e1", output: { score: 2 } });
    assert.equal(ok, true);
  });

  it("exercises filter operators and types", async () => {
    assert.ok(Types.varchar(10).kind.includes("varchar"));
    assert.equal(Types.enum("a", "b").kind, "enum");
    const user = buildUserModel(
      flows({
        async create() {
          return Failed;
        },
        async list() {
          return Running;
        },
        async update() {
          return Running;
        },
        async delete() {
          return Failed;
        },
      }),
    );
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt, notifyExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    await fookie.create(user, {
      email: "f@f.com",
      name: "F",
      score: 1,
      location: [0, 0],
      meta: "{}",
    });
    await fookie.list(user, {
      email: { like: "%@%" },
      name: { ilike: "f%" },
      score: { gte: 0, lte: 100, in: [1, 2] },
      location: { near: [0, 0, 100] },
    });
    await fookie.update(user, {
      id: "00000000-0000-7000-8000-000000000099",
      body: { name: "X" },
      filter: { name: { ne: "y" } },
    });
    await fookie.delete(user, {
      id: "00000000-0000-7000-8000-000000000099",
      filter: { meta: { contains: "{}" } },
    });
    assert.equal(
      await fookie.setExternalResult({ externalId: "missing", output: { score: 1 } }),
      false,
    );
  });
});
