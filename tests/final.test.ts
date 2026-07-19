import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app, Model, External, Types, Done, Failed, Running, flows, OutboxPending, OutboxFailed, OutboxCompleted } from "../src/index.ts";
import { MockDb, httpPost, httpRaw, httpAbort, httpSocketDrop, trackApp, shutdownLiveApps } from "./mock-db.ts";

let nextPort = 44000;

const scoreExt = External({
  name: "fraud.score",
  input: { amount: Types.currency },
  output: { score: Types.int },
  attempts: 1,
  backoff: "fixed",
});

function httpThrow(port: number, path: string) {
  return new Promise<number>((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: { "x-fookie-test-throw": "1" },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("final coverage", () => {
  let db: MockDb;
  let port: number;

  beforeEach(() => {
    process.env.FOOKIE_ALLOW_TEST_THROW = "1";
    db = new MockDb();
    port = nextPort;
    nextPort += 10;
  });

  afterEach(async () => {
    await shutdownLiveApps();
  });

  it("covers external invalid completed output and ghost resume", async () => {
    const user = Model({
      name: "Ghost",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const ext = await flow.external(scoreExt, { amount: 12 });
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
      pool: [db],
    });

    const pending = await fookie.create(user, { email: "g@g.com" });
    if (pending.signal !== "running") {
      return;
    }
    const externalId = events[0] ?? "";
    assert.equal(await fookie.patchOutbox(externalId, { score: "bad" }), false);
    assert.equal(await fookie.patchOutbox(externalId, { score: 3 }), true);
    assert.equal(await fookie.resume(pending.runId), "done");

    db.outbox.set("ghost", {
      external_id: "ghost",
      name: "fraud.score",
      status: OutboxPending,
      input: { amount: 1 },
      output: null,
      entity_id: "e",
      model: "Ghost",
      run_id: "missing-run",
      attempt: 1,
    });
    const fookie2 = app({
      listen: String(port + 1),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    await fookie2.list(user, {});
    assert.equal(
      await fookie2.setExternalResult({ externalId: "ghost", output: { score: 1 } }),
      true,
    );
  });

  it("covers model ref binding, persist failures, and mutation validation", async () => {
    const parent = Model({
      name: "Parent",
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

    const child = Model({
      name: "Child",
      fields: {
        title: Types.string,
        parent: Types.relation({ name: "Parent" }),
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

    const wrapper = Model({
      name: "Wrapper",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const nested = await flow.create(child, {
            title: "t",
            parent: "00000000-0000-4000-8000-000000000001",
          });
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

    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [parent, child, wrapper],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });

    const parentCreated = await fookie.create(parent, { email: "p@p.com" });
    if (parentCreated.signal !== "done") {
      return;
    }

    await fookie.create(wrapper, { email: "w@w.com" });

    db.mode = "fail-upsert";
    const failParent = Model({
      name: "FailParent",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          return (await flow.create(child, { title: "fail", parent: flow.id })).signal;
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
      models: [parent, child, failParent],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    await f2.create(failParent, { email: "f@f.com" });

    db.mode = "ok";
    const coord = Model({
      name: "Coord",
      fields: { email: Types.email, loc: Types.coordinate },
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
    const f3 = app({
      listen: String(port + 2),
      database: "postgres://mock",
      models: [coord],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    const c = await f3.create(coord, { email: "c@c.com", loc: [1, 2] });
    if (c.signal === "done") {
      db.mode = "fail-upsert";
      await f3.update(coord, {
        id: c.id,
        body: { loc: [3, 4] },
        filter: { email: { eq: "c@c.com" } },
      });
      db.mode = "ok";
      await f3.delete(coord, { id: c.id, filter: { email: { eq: "c@c.com" } } });
    }

    assert.equal(
      await fookie.update(parent, { id: "x", body: { email: "not-email" }, filter: {} }),
      "failed",
    );
    assert.equal(
      await fookie.update(parent, { id: "x", body: {}, filter: { email: { eq: 1 } } }),
      "failed",
    );
    assert.equal(await fookie.delete(parent, { id: "x", filter: { email: { eq: 1 } } }), "failed");
  });

  it("covers transaction rollback failure and db bootstrap errors", async () => {
    const user = Model({
      name: "Bootstrap",
      fields: { email: Types.email.unique() },
      flow: flows({
        async create() {
          throw new Error("boom");
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

    db.failOnSql = "fookie_outbox";
    const f1 = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    assert.equal((await f1.create(user, { email: "b@b.com" })).signal, "failed");

    db.failOnSql = "";
    db.failRollback = true;
    const f2 = app({
      listen: String(port + 1),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    assert.equal((await f2.create(user, { email: "b2@b.com" })).signal, "failed");
  });

  it("covers http create failed, path edge cases, and filter parsing", async () => {
    const user = Model({
      name: "HttpFinal",
      fields: { email: Types.email, n: Types.integer, note: Types.json },
      flow: flows({
        async create() {
          return Failed;
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

    const fookie = trackApp(app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    }));
    fookie.run();

    const failedCreate = await httpPost(port, "/httpfinal/create", {
      body: { email: "h@f.com", n: 1, note: "{}" },
    });
    assert.equal(failedCreate.json.signal, "failed");

    const short = await httpPost(port, "/httpfinal/only-id", {});
    assert.equal(short.status, 404);

    const emptyId = await httpPost(port, "/httpfinal//delete", { filter: {} });
    assert.equal(emptyId.status, 404);

    const invalidBody = await httpPost(port, "/httpfinal/id/update", {
      body: { email: "not-email", n: 1, note: "{}" },
      filter: { email: { eq: "h@f.com" } },
    });
    assert.equal(invalidBody.status, 400);

    const filterOps = await httpPost(port, "/httpfinal/list", {
      filter: {
        n: { gt: 1, gte: 2, lt: 10, lte: 9, ne: 0 },
        email: { like: "%@%", ilike: "%a%" },
        note: { contains: "a" },
      },
    });
    assert.equal(filterOps.status, 200);

    const listNoFilter = await httpPost(port, "/httpfinal/list", {});
    assert.equal(listNoFilter.status, 200);

    const throwStatus = await httpThrow(port, "/httpfinal/list");
    assert.equal(throwStatus, 500);
  });

  it("covers pg parsing, cache, and nested invalid create", async () => {
    const user = Model({
      name: "PgParse",
      fields: {
        email: Types.email,
        n: Types.integer,
        active: Types.bool,
        pt: Types.point,
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

    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });

    const created = await fookie.create(user, {
      email: "p@g.com",
      n: 7,
      active: true,
      pt: [4, 5],
    });
    if (created.signal !== "done") {
      return;
    }

    db.rows.get("pg_parse")?.set(created.id, {
      id: created.id,
      email: "p@g.com",
      n: "42",
      active: "t",
      pt: "(4,5)",
      created_at: "2020-01-01T00:00:00.000",
      updated_at: "2020-01-01T00:00:00.000",
      is_deleted: false,
    });

    await fookie.list(user, { email: { eq: "p@g.com" } });
    await fookie.list(user, { unknown: { eq: "x" } });

    db.outbox.set("obj-status", {
      external_id: "obj-status",
      name: "fraud.score",
      status: { x: 1 },
      input: { amount: 1 },
      output: null,
      entity_id: "e",
      model: "PgParse",
      run_id: "r",
    });
    await fookie.list(user, {});

    const parent = Model({
      name: "BadNest",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          return (await flow.create(child, { title: 1 })).signal;
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
    const child = Model({
      name: "BadChild",
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
    const f2 = app({
      listen: String(port + 1),
      database: "postgres://mock",
      models: [parent, child],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    await f2.create(parent, { email: "b@n.com" });

    assert.equal(await fookie.patchOutbox("missing", { score: 1 }), false);
  });

  it("covers remaining runtime and http branches", async () => {
    const parent = Model({
      name: "Parent",
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

    const child = Model({
      name: "Child",
      fields: {
        title: Types.string,
        parent: Types.relation({ name: "Parent" }),
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

    const wrapper = Model({
      name: "Wrap",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          return (await flow.create(child, { title: "bind", parent: flow.id })).signal;
        },
        async list(flow) {
          return (await flow.list(child, { bad: {} })).signal;
        },
        async update(flow) {
          const created = await flow.create(child, { title: "u", parent: flow.id });
          if (created.signal !== "done" || !("id" in created)) {
            return Failed;
          }
          db.mode = "fail-upsert";
          const updated = await flow.update(child, {
            id: created.id,
            body: { title: "u2" },
            filter: { title: { eq: "u" } },
          });
          db.mode = "ok";
          return updated.signal;
        },
        async delete(flow) {
          const created = await flow.create(child, { title: "d", parent: flow.id });
          if (created.signal !== "done" || !("id" in created)) {
            return Failed;
          }
          db.mode = "fail-upsert";
          const deleted = await flow.delete(child, {
            id: created.id,
            filter: { title: { eq: "d" } },
          });
          db.mode = "ok";
          return deleted.signal;
        },
      }),
    });

    const extUser = Model({
      name: "ExtRun",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const ext = await flow.external(scoreExt, { amount: 3 });
          return ext.signal === "done" ? Done : ext.signal;
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
      models: [parent, child, wrapper, extUser],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });

    await fookie.create(wrapper, { email: "w@w.com" });
    await fookie.list(wrapper, {});
    await fookie.update(wrapper, {
      id: "00000000-0000-7000-8000-000000000099",
      body: {},
      filter: {},
    });
    await fookie.delete(wrapper, { id: "00000000-0000-7000-8000-000000000099", filter: {} });

    const events: string[] = [];
    const f2 = app({
      listen: String(port + 1),
      database: "postgres://mock",
      models: [extUser],
      externals: [scoreExt] as const,
      onExternalEvent: async (e) => events.push(e.externalId),
      pool: [db],
    });
    const pending = await f2.create(extUser, { email: "e@e.com" });
    if (pending.signal === "running") {
      const externalId = events[0] ?? "";
      await f2.setExternalResult({ externalId, output: { score: 7 } });
    }

    const httpModel = Model({
      name: "HttpLeft",
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
    const f3 = trackApp(app({
      listen: String(port + 2),
      database: "postgres://mock",
      models: [httpModel],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    }));
    f3.run();
    const slash = await httpPost(port + 2, "/httpleft//update", {
      filter: {},
      body: { email: "a@b.com" },
    });
    assert.equal(slash.status, 404);
    const badRecord = await httpPost(port + 2, "/httpleft/create", { body: { email: 1 } });
    assert.equal(badRecord.status, 400);

    db.mode = "fail-select";
    const miss = await fookie.update(parent, {
      id: "00000000-0000-7000-8000-000000000000",
      body: { email: "n@e.com" },
      filter: {},
    });
    assert.equal(miss, "failed");
    db.mode = "ok";
  });

  it("covers http request error and json coordinate upsert", async () => {
    const jsonUser = Model({
      name: "JsonCoord",
      fields: { email: Types.email, data: Types.jsonb },
      flow: flows({
        async create() {
          return Done;
        },
        async list() {
          return Done;
        },
        async update(flow) {
          Reflect.set(flow.body, "data", [9, 8]);
          return Done;
        },
        async delete() {
          return Done;
        },
      }),
    });

    const fookie = trackApp(app({
      listen: String(port),
      database: "postgres://mock",
      models: [jsonUser],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    }));
    fookie.run();

    const created = await fookie.create(jsonUser, { email: "j@c.com", data: "{}" });
    if (created.signal !== "done") {
      return;
    }
    await fookie.update(jsonUser, {
      id: created.id,
      body: { data: "{}" },
      filter: { email: { eq: "j@c.com" } },
    });

    const broken = await httpAbort(port, "/jsoncoord/list");
    assert.equal(broken, 400);

    const dropped = await httpSocketDrop(port, "/jsoncoord/list");
    assert.equal(dropped, 400);
  });
});
