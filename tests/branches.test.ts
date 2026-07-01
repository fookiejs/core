import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  app,
  Model,
  External,
  Types,
  Done,
  Running,
  Failed,
  flows,
  type CreateResult,
} from "../src/index.ts";
import { MockDb, httpPost, httpRaw } from "./mock-db.ts";

const scoreExt = External({
  name: "fraud.score",
  input: { amount: Types.currency },
  output: { score: Types.int },
  attempts: 1,
  backoff: "fixed",
});

describe("branch coverage", () => {
  let db: MockDb;
  let port: number;

  beforeEach(() => {
    db = new MockDb();
    port = 43000 + Math.floor(Math.random() * 1000);
  });

  it("covers relation models, filter branches, and pg parsing", async () => {
    const buyer = Model({
      name: "Buyer",
      fields: { email: Types.email },
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

    const order = Model({
      name: "Order",
      fields: {
        buyer,
        amount: Types.float,
        point: Types.coordinate,
        meta: Types.jsonb,
        status: Types.enum("a", "b"),
      },
      flow: flows({
        async create() {
          return Done;
        },
        async list(flow) {
          flow.filter.amount.eq(1).gt(0);
          flow.filter.amount.eq(2);
          flow.filter.status.eq("a").startsWith("a").endsWith("a");
          flow.filter.point.near(0, 0, 5);
          flow.filter.meta.contains("{}");
          flow.filter.buyer.eq("00000000-0000-4000-8000-000000000001");
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

    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [buyer, order],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });

    const buyerCreated = await fookie.create(buyer, { email: "b@o.com" });
    assert.equal(buyerCreated.signal, "done");
    if (buyerCreated.signal !== "done") {
      return;
    }

    const created = await fookie.create(order, {
      buyer: buyerCreated.id,
      amount: 9.5,
      point: [2, 3],
      meta: "{}",
      status: "a",
    });
    assert.equal(created.signal, "done");

    await fookie.list(order, {
      amount: { eq: 9.5, gt: 1, gte: 1, lt: 20, lte: 20, in: [9.5] },
      status: { like: "a%", ilike: "A%", startsWith: "a", endsWith: "a" },
      point: { near: [0, 0, 10] },
      meta: { contains: "{}" },
      buyer: { eq: buyerCreated.id, in: [buyerCreated.id] },
    });

    if (created.signal === "done") {
      db.rows.get("order")?.set(created.id, {
        id: created.id,
        buyer: buyerCreated.id,
        amount: "9.5",
        point: "(2,3)",
        meta: "{}",
        status: "a",
        created_at: "2020-01-01T00:00:00.000Z",
        updated_at: "2020-01-01T00:00:00.000Z",
        is_deleted: false,
      });
      await fookie.list(order, { buyer: { eq: buyerCreated.id } });
    }
  });

  it("covers resume, external outbox branches, and nested persist", async () => {
    const child = Model({
      name: "Note",
      fields: {
        title: Types.string,
        owner: Types.relation({ name: "Owner" }),
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

    const owner = Model({
      name: "Owner",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const ext = await flow.external(scoreExt, { amount: 20 });
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
    });

    const parent = Model({
      name: "Parent",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const nested = await flow.create(child, { title: "t", owner: flow.id });
          if (nested.signal === "done" && "entity" in nested) {
            return Done;
          }
          return nested.signal;
        },
        async list(flow) {
          const nested = await flow.list(child, { title: { eq: "t" } });
          return nested.signal;
        },
        async update(flow) {
          const created = await flow.create(child, { title: "u", owner: flow.id });
          if (created.signal !== "done" || !("id" in created)) {
            return Failed;
          }
          const updated = await flow.update(child, {
            id: created.id,
            body: { title: "u2" },
            filter: { title: { eq: "u" } },
          });
          return updated.signal;
        },
        async delete(flow) {
          const created = await flow.create(child, { title: "d", owner: flow.id });
          if (created.signal !== "done" || !("id" in created)) {
            return Failed;
          }
          const deleted = await flow.delete(child, {
            id: created.id,
            filter: { title: { eq: "d" } },
          });
          return deleted.signal;
        },
      }),
    });

    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [owner, child, parent],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });

    const pending = await fookie.create(owner, { email: "o@o.com" });
    assert.equal(pending.signal, "running");
    if (pending.signal !== "running") {
      return;
    }
    const again = await fookie.resume(pending.runId);
    assert.equal(again, "running");
    assert.equal(await fookie.resume("missing-run"), "failed");

    await fookie.create(parent, { email: "p@p.com" });
    await fookie.list(parent, {});
    await fookie.update(parent, {
      id: "00000000-0000-7000-8000-000000000099",
      body: {},
      filter: {},
    });
    await fookie.delete(parent, { id: "00000000-0000-7000-8000-000000000099", filter: {} });
  });

  it("covers outbox hydration and invalid rows", async () => {
    db.outbox.set("p1", {
      external_id: "p1",
      name: "fraud.score",
      status: "pending",
      input: { amount: 1 },
      output: null,
      entity_id: "e1",
      model: "Owner",
      run_id: "r1",
    });
    db.outbox.set("f2", {
      external_id: "f2",
      name: "fraud.score",
      status: "failed",
      input: { amount: 2 },
      output: null,
      entity_id: "e2",
      model: "Owner",
      run_id: "r2",
    });
    db.outbox.set("c1", {
      external_id: "c1",
      name: "fraud.score",
      status: "completed",
      input: { amount: 3 },
      output: { score: 3 },
      entity_id: "e3",
      model: "Owner",
      run_id: "r3",
    });
    db.outbox.set("bad1", {
      external_id: "bad1",
      name: "fraud.score",
      status: 99,
      input: { amount: 4 },
      output: null,
      entity_id: "e4",
      model: "Owner",
      run_id: "r4",
    });
    db.outbox.set("bad2", {
      external_id: "bad2",
      name: "fraud.score",
      status: "completed",
      input: "not-json",
      output: null,
      entity_id: "e5",
      model: "Owner",
      run_id: "r5",
    });
    db.outbox.set("bad3", {
      external_id: "bad3",
      name: "fraud.score",
      status: "completed",
      input: { amount: 5 },
      output: "bad",
      entity_id: "e6",
      model: "Owner",
      run_id: "r6",
    });

    const user = Model({
      name: "Hydrate",
      fields: { email: Types.email },
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

    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    await fookie.list(user, {});
  });

  it("covers http edge cases and mutation signals", async () => {
    const user = Model({
      name: "Edge",
      fields: { email: Types.email, loc: Types.coordinate },
      flow: flows({
        async create() {
          return Running;
        },
        async list() {
          return Done;
        },
        async update() {
          return Failed;
        },
        async delete() {
          return Done;
        },
      }),
    });

    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    fookie.run();

    const running = await httpPost(port, "/edge/create", {
      body: { email: "e@d.com", loc: [1, 2] },
    });
    assert.equal(running.json.signal, "running");

    const failed = await httpPost(port, "/edge/00000000-0000-7000-8000-000000000099/update", {
      body: { loc: [2, 3] },
      filter: { email: { eq: "e@d.com" } },
    });
    assert.equal(failed.json.signal, "failed");

    const shortPath = await httpPost(port, "/only", {});
    assert.equal(shortPath.status, 404);

    const nullBody = await httpRaw(port, "/edge/list", "null");
    assert.equal(nullBody.status, 400);

    const arrayBody = await httpRaw(port, "/edge/list", "[]");
    assert.equal(arrayBody.status, 400);

    const filterOps = await httpPost(port, "/edge/list", {
      filter: {
        email: { eq: "e@d.com", ne: "x@y.com", in: ["e@d.com"] },
        loc: { near: [0, 0, 5] },
      },
    });
    assert.equal(filterOps.status, 200);

    const ext = await httpPost(port, "/external/result", { externalId: "x", output: { score: 1 } });
    assert.equal(ext.json.ok, false);
  });

  it("covers failed external resume and update coordinate body", async () => {
    const user = Model({
      name: "ResumeUser",
      fields: { email: Types.email, loc: Types.coordinate },
      flow: flows({
        async create(flow) {
          const ext = await flow.external(scoreExt, { amount: 15 });
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
    });

    const events: string[] = [];
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async (e) => events.push(e.externalId),
      pool: db,
    });

    const pending = await fookie.create(user, { email: "r@r.com", loc: [0, 0] });
    if (pending.signal !== "running") {
      return;
    }
    const externalId = events[0] ?? "";
    await fookie.setExternalResult({ externalId, output: { score: "nope" } });
    assert.equal(await fookie.resume(pending.runId), "failed");

    const created = await fookie.create(user, { email: "u@u.com", loc: [2, 2] });
    if (created.signal !== "done") {
      return;
    }
    await fookie.update(user, {
      id: created.id,
      body: { loc: [3, 4] },
      filter: { email: { eq: "u@u.com" } },
    });
  });

  it("covers db failure paths and transaction rollback errors", async () => {
    const user = Model({
      name: "DbFail",
      fields: { email: Types.email.unique(), data: Types.json },
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

    db.mode = "fail-select";
    const f1 = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    await f1.list(user, { email: { eq: "a@a.com" } });

    db.mode = "ok";
    db.failOnSql = "SELECT external_id";
    const f2 = app({
      listen: String(port + 1),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    assert.equal((await f2.create(user, { email: "d@d.com", data: "{}" })).signal, "failed");

    db.failOnSql = "";
    db.failRollback = true;
    db.mode = "fail-query";
    const f3 = app({
      listen: String(port + 2),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    assert.equal((await f3.create(user, { email: "e@e.com", data: "{}" })).signal, "failed");
  });

  it("rejects invalid json field and invalid nested create", async () => {
    const user = Model({
      name: "JsonUser",
      fields: { email: Types.email, data: Types.json },
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

    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });

    const bad: CreateResult<Record<string, string | number | boolean>> = await fookie.create(user, {
      email: "j@j.com",
      data: "not-json",
    });
    assert.equal(bad.signal, "failed");

    const parent = Model({
      name: "BadParent",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const nested = await flow.create({ name: "Missing" }, { email: "x" });
          return nested.signal;
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

    const f2 = app({
      listen: String(port + 1),
      database: "postgres://mock",
      models: [parent, user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    await f2.create(parent, { email: "b@b.com" });
  });

  it("covers remaining http, outbox, and nested failure paths", async () => {
    const user = Model({
      name: "Left",
      fields: { email: Types.email },
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

    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    fookie.run();

    const badDeleteFilter = await httpPost(port, "/left/id/delete", {
      filter: { email: { eq: 1 } },
    });
    assert.equal(badDeleteFilter.status, 400);

    const badUpdateFilter = await httpPost(port, "/left/id/update", {
      body: { email: "x@y.com" },
      filter: { email: { eq: 1 } },
    });
    assert.equal(badUpdateFilter.status, 400);

    const missingAction = await httpPost(port, "/left/id/missing", { filter: {} });
    assert.equal(missingAction.status, 404);

    db.outbox.set("wrong-ext", {
      external_id: "wrong-ext",
      name: "other.service",
      status: "pending",
      input: { amount: 1 },
      output: null,
      entity_id: "e",
      model: "Left",
      run_id: "r",
    });
    await fookie.list(user, {});
    assert.equal(
      await fookie.setExternalResult({ externalId: "wrong-ext", output: { score: 1 } }),
      false,
    );

    db.mode = "fail-outbox-save";
    const extUser = Model({
      name: "OutboxFail",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const ext = await flow.external(scoreExt, { amount: 5 });
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
    });
    const f2 = app({
      listen: String(port + 1),
      database: "postgres://mock",
      models: [extUser],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    await f2.create(extUser, { email: "o@f.com" });

    const parent = Model({
      name: "NestFail",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          return (await flow.update({ name: "Ghost" }, { id: "x", body: {}, filter: {} })).signal;
        },
        async list(flow) {
          return (await flow.delete({ name: "Ghost" }, { id: "x", filter: {} })).signal;
        },
        async update() {
          return Done;
        },
        async delete() {
          return Done;
        },
      }),
    });
    const f3 = app({
      listen: String(port + 2),
      database: "postgres://mock",
      models: [parent],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    await f3.create(parent, { email: "n@f.com" });
    await f3.list(parent, {});

    db.mode = "ok";
    db.mode = "fail-upsert";
    const child = Model({
      name: "PersistFail",
      fields: { title: Types.string },
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
    const parent2 = Model({
      name: "PersistParent",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          return (await flow.create(child, { title: "x" })).signal;
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
    const f4 = app({
      listen: String(port + 3),
      database: "postgres://mock",
      models: [parent2, child],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    await f4.create(parent2, { email: "p@f.com" });

    db.mode = "ok";
    const created = await fookie.create(user, { email: "cache@t.com" });
    if (created.signal === "done") {
      await fookie.update(user, {
        id: created.id,
        body: { email: "cache@t.com" },
        filter: { email: { eq: "cache@t.com" } },
      });
      await fookie.update(user, {
        id: "00000000-0000-7000-8000-000000000000",
        body: {},
        filter: {},
      });
    }
  });

  it("covers model ref binding, db cache miss, and filter edge branches", async () => {
    const refChild = Model({
      name: "RefChild",
      fields: {
        title: Types.string,
        owner: { name: "RefParent" },
      },
      flow: flows({
        async create() {
          return Done;
        },
        async list() {
          return Failed;
        },
        async update() {
          return Done;
        },
        async delete() {
          return Done;
        },
      }),
    });

    const refParent = Model({
      name: "RefParent",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const nested = await flow.create(refChild, { title: "bound" });
          return nested.signal;
        },
        async list(flow) {
          const ok = await flow.list(refChild, { title: { eq: "bound" } });
          const bad = await flow.list(refChild, { title: { eq: 1 } });
          return bad.signal === "failed" ? ok.signal : Failed;
        },
        async update(flow) {
          const created = await flow.create(refChild, { title: "u" });
          if (created.signal !== "done" || !("id" in created)) {
            return Failed;
          }
          const badFilter = await flow.update(refChild, {
            id: created.id,
            body: { title: "u2" },
            filter: { title: { eq: 1 } },
          });
          const badBody = await flow.update(refChild, {
            id: created.id,
            body: { title: "x", owner: "not-a-uuid" },
            filter: { title: { eq: "u" } },
          });
          return badFilter.signal === "failed" || badBody.signal === "failed" ? Done : Failed;
        },
        async delete(flow) {
          return (await flow.delete(refChild, { id: "x", filter: { title: { eq: 1 } } })).signal;
        },
      }),
    });

    const cacheUser = Model({
      name: "CacheUser",
      fields: { email: Types.email, loc: Types.coordinate, meta: Types.jsonb },
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

    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [refParent, refChild, cacheUser],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });

    const parentCreated = await fookie.create(refParent, { email: "ref@p.com" });
    if (parentCreated.signal === "done") {
      await fookie.update(refParent, { id: parentCreated.id, body: {}, filter: {} });
      await fookie.delete(refParent, { id: parentCreated.id, filter: {} });
    }
    const extChild = Model({
      name: "ExtChild",
      fields: { title: Types.string, owner: { name: "RefParent" } },
      flow: flows({
        async create(flow) {
          const ext = await flow.external(scoreExt, { amount: 4 });
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
    });

    const extParent = Model({
      name: "ExtParent",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          return (await flow.create(extChild, { title: "ext" })).signal;
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

    const fookieExt = app({
      listen: String(port + 5),
      database: "postgres://mock",
      models: [refParent, refChild, extParent, extChild],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    await fookieExt.create(extParent, { email: "ext@p.com" });

    await fookie.list(refParent, {});

    const created = await fookie.create(cacheUser, {
      email: "cache@x.com",
      loc: [1, 1],
      meta: "{}",
    });
    if (created.signal !== "done") {
      return;
    }
    const table = "cache_user";
    const row = db.rows.get(table)?.get(created.id);
    if (row) {
      delete row.is_deleted;
      row.ghost_col = "extra";
    }
    const fookie2 = app({
      listen: String(port + 1),
      database: "postgres://mock",
      models: [cacheUser],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });
    await fookie2.update(cacheUser, {
      id: created.id,
      body: { email: "cache@y.com" },
      filter: { email: { eq: "cache@x.com" } },
    });

    assert.equal(
      await fookie.update(cacheUser, {
        id: created.id,
        body: { email: "not-an-email" },
        filter: { email: { eq: "cache@y.com" } },
      }),
      "failed",
    );

    await fookie.list(cacheUser, { loc: { near: [0, 0] } });

    fookie.run();
    const badBody = await httpPost(port, "/cacheuser/create", { body: 123 });
    assert.equal(badBody.status, 200);

    const badList = await httpPost(port, "/cacheuser/list", { filter: { email: { eq: 1 } } });
    assert.equal(badList.status, 400);

    assert.equal(await fookie.list(cacheUser, { email: { eq: 1 } }), "failed");

    db.mode = "fail-upsert";
    await fookie.delete(cacheUser, { id: created.id, filter: { email: { eq: "cache@y.com" } } });
    db.mode = "ok";
  });
});
