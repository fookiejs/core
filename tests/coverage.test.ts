import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { app, Model, External, Types, Done, Running, Failed, flows, models, OutboxPending, OutboxFailed, OutboxCompleted } from "../src/index.ts";
import { MockDb, httpPost, httpRaw, trackApp, shutdownLiveApps } from "./mock-db.ts";

let nextPort = 42000;

const scoreExt = External({
  name: "fraud.score",
  input: { amount: Types.currency },
  output: { score: Types.int },
  attempts: 1,
  backoff: "fixed",
});

describe("coverage", () => {
  let db: MockDb;
  let port: number;

  beforeEach(() => {
    db = new MockDb();
    port = nextPort;
    nextPort += 10;
  });

  afterEach(async () => {
    await shutdownLiveApps();
  });

  it("covers types builders and filter ops", async () => {
    assert.equal(Types.smallint.unique().index().min(0).max(1).kind, "smallint");
    assert.equal(Types.bigint.unique().index().kind, "bigint");
    assert.equal(Types.integer.unique().index().kind, "integer");
    assert.equal(Types.real.unique().index().kind, "real");
    assert.equal(Types.doublePrecision.unique().index().kind, "doublePrecision");
    assert.equal(Types.serial.unique().index().kind, "serial");
    assert.equal(Types.bigserial.unique().index().kind, "bigserial");
    assert.equal(Types.text.unique().index().kind, "text");
    assert.ok(Types.varchar(5).unique().index().kind.includes("varchar"));
    assert.ok(Types.char(3).unique().index().kind.includes("char"));
    assert.equal(Types.boolean.unique().index().kind, "boolean");
    assert.equal(Types.uuid.unique().index().kind, "uuid");
    assert.equal(Types.date.unique().index().kind, "date");
    assert.equal(Types.time.unique().index().kind, "time");
    assert.equal(Types.timetz.unique().index().kind, "timetz");
    assert.equal(Types.timestamp.unique().index().kind, "timestamp");
    assert.equal(Types.interval.unique().index().kind, "interval");
    assert.equal(Types.json.unique().index().kind, "json");
    assert.equal(Types.bytea.unique().index().kind, "bytea");
    assert.equal(Types.inet.unique().index().kind, "inet");
    assert.equal(Types.cidr.unique().index().kind, "cidr");
    assert.equal(Types.macaddr.unique().index().kind, "macaddr");
    assert.equal(Types.money.unique().index().kind, "money");
    assert.equal(Types.point.unique().index().kind, "point");
    assert.equal(Types.line.unique().index().kind, "line");
    assert.equal(Types.lseg.unique().index().kind, "lseg");
    assert.equal(Types.box.unique().index().kind, "box");
    assert.equal(Types.path.unique().index().kind, "path");
    assert.equal(Types.polygon.unique().index().kind, "polygon");
    assert.equal(Types.circle.unique().index().kind, "circle");
    assert.equal(Types.xml.unique().index().kind, "xml");
    assert.equal(Types.url.unique().index().kind, "url");
    assert.equal(Types.enum("a", "b").unique().index().kind, "enum");

    const all = Model({
      name: "AllTypes",
      fields: {
        n: Types.smallint,
        bi: Types.bigint,
        nu: Types.numeric,
        r: Types.real,
        dp: Types.doublePrecision,
        se: Types.serial,
        bs: Types.bigserial,
        s: Types.string,
        vc: Types.varchar(10),
        ch: Types.char(2),
        bo: Types.bool,
        u: Types.uuid,
        da: Types.date,
        ti: Types.time,
        tt: Types.timetz,
        ts: Types.timestamp,
        tz: Types.timestamptz,
        iv: Types.interval,
        js: Types.json,
        jb: Types.jsonb,
        ba: Types.bytea,
        inet: Types.inet,
        cidr: Types.cidr,
        mac: Types.macaddr,
        mo: Types.money,
        pt: Types.point,
        ln: Types.line,
        em: Types.email,
        ur: Types.url,
        en: Types.enum("x", "y"),
      },
      flow: flows({
        async create() {
          return Done;
        },
        async list(flow) {
          flow.filter.n.eq(1).ne(2).gt(0).gte(1).lt(10).lte(9).in([1, 2]);
          flow.filter.n.eq(1).ne(2);
          flow.filter.s
            .eq("a")
            .ne("b")
            .like("%")
            .ilike("%")
            .startsWith("a")
            .endsWith("z")
            .in(["a"]);
          flow.filter.bo.eq(true).ne(false).gt(0);
          flow.filter.u
            .eq("00000000-0000-4000-8000-000000000001")
            .in(["00000000-0000-4000-8000-000000000001"]);
          flow.filter.ts.eq("2020-01-01T00:00:00.000").gt("2019-01-01T00:00:00.000");
          flow.filter.pt.eq([1, 2]).near(0, 0, 10);
          flow.filter.jb.contains("{}");
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

    const m2 = Model({
      name: "M2",
      fields: { x: Types.string },
      flow: flows({
        create: async () => Done,
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
    });
    const m3 = Model({
      name: "M3",
      fields: { x: Types.string },
      flow: flows({
        create: async () => Done,
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
    });
    const m4 = Model({
      name: "M4",
      fields: { x: Types.string },
      flow: flows({
        create: async () => Done,
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
    });

    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: models([all, m2, m3, m4]),
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });

    await fookie.list(all, {
      n: { eq: 1, ne: 2, gt: 0, gte: 1, lt: 10, lte: 9, in: [1] },
      s: { eq: "a", like: "%a%", ilike: "%A%", startsWith: "a", endsWith: "z" },
      bo: { eq: true },
      u: { eq: "00000000-0000-4000-8000-000000000001" },
      ts: { gte: "2020-01-01T00:00:00.000" },
      pt: { near: [0, 0, 5] },
      jb: { contains: "{}" },
    });

    const created = await fookie.create(all, {
      n: 1,
      bi: "1",
      nu: "1.5",
      r: 1.1,
      dp: 2.2,
      se: 1,
      bs: "2",
      s: "text",
      vc: "abcde",
      ch: "ab",
      bo: true,
      u: "00000000-0000-4000-8000-000000000001",
      da: "2020-01-01",
      ti: "12:00:00",
      tt: "12:00:00+00",
      ts: "2020-01-01T00:00:00.000",
      tz: "2020-01-01T00:00:00.000Z",
      iv: "1 day",
      js: "{}",
      jb: "{}",
      ba: "\\xab",
      inet: "127.0.0.1",
      cidr: "127.0.0.0/24",
      mac: "00:11:22:33:44:55",
      mo: "10",
      pt: [1, 2],
      ln: "{1,0,-1}",
      em: "a@b.com",
      ur: "https://x.com",
      en: "x",
    });
    assert.equal(created.signal, "done");
  });

  it("covers external branches and failures", async () => {
    const userBad = Model({
      name: "ExtUserBad",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const bad = await flow.external(scoreExt, { amount: -1 });
          return bad.signal === "failed" ? Failed : Done;
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
    const user = Model({
      name: "ExtUser",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const ext = await flow.external(scoreExt, { amount: 10 });
          if (ext.signal === "done") return Done;
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
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [userBad],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    assert.equal((await fookie.create(userBad, { email: "e@e.com" })).signal, "failed");

    const events: string[] = [];
    const fookie2 = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async (e) => events.push(e.externalId),
      pool: [db],
    });
    const pending = await fookie2.create(user, { email: "f@f.com" });
    assert.equal(pending.signal, "running");
    const externalId = events[0] ?? "";
    assert.equal(await fookie2.setExternalResult({ externalId, output: { score: 9 } }), true);
    assert.equal(await fookie2.setExternalResult({ externalId, output: { score: "bad" } }), true);

    db.outbox.set("wrong-name", {
      external_id: "wrong-name",
      name: "unknown.external",
      status: OutboxPending,
      input: { amount: 1 },
      output: null,
      entity_id: "e",
      model: "ExtUser",
      run_id: "r",
      attempt: 1,
    });
    assert.equal(
      await fookie2.setExternalResult({ externalId: "wrong-name", output: { score: 1 } }),
      false,
    );
  });

  it("covers http mutations and errors", async () => {
    const user = Model({
      name: "HttpUser",
      fields: { email: Types.email, name: Types.string },
      flow: flows({
        create: async () => Done,
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
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
    const created = await httpPost(port, "/httpuser/create", {
      body: { email: "h@u.com", name: "H" },
    });
    assert.equal(created.json.signal, "done");
    const id = String((created.json as { id?: string }).id ?? "");
    const updated = await httpPost(port, `/httpuser/${id}/update`, {
      body: { name: "Hu" },
      filter: { email: { eq: "h@u.com" } },
    });
    assert.equal(updated.json.signal, "done");
    const deleted = await httpPost(port, `/httpuser/${id}/delete`, {
      filter: { email: { eq: "h@u.com" } },
    });
    assert.equal(deleted.json.signal, "done");
    const ext = await httpPost(port, "/external/result", {
      externalId: "missing",
      output: { score: 1 },
    });
    assert.equal(ext.json.error, "external result rejected");
    const invalid = await httpPost(port, "/httpuser/create", { body: { email: "bad", name: "X" } });
    assert.equal(invalid.status, 400);
    const badFilter = await httpPost(port, "/httpuser/list", { filter: { email: { eq: 1 } } });
    assert.equal(badFilter.status, 400);
    const badJson = (await httpRaw(port, "/httpuser/list", "{")).status;
    assert.equal(badJson, 400);
    const notFound = await httpPost(port, "/httpuser/id/unknown", { filter: {} });
    assert.equal(notFound.status, 404);

    db.outbox.set("bad-row", {
      external_id: "bad-row",
      name: "fraud.score",
      status: "weird",
      input: "bad",
      output: null,
      entity_id: "e",
      model: "HttpUser",
      run_id: "r",
    });
    db.failOnSql = "SELECT external_id";
    const f2 = app({
      listen: String(port + 1),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    await f2.list(user, {});
  });

  it("covers db and transaction failure paths", async () => {
    const user = Model({
      name: "FailUser",
      fields: { email: Types.email.unique() },
      flow: flows({
        create: async () => Done,
        list: async () => Done,
        update: async () => Done,
        delete: async () => Done,
      }),
    });
    db.mode = "fail-create-table";
    const stdoutSpy = mock.method(process.stdout, "write", () => true);
    const f1 = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    assert.equal((await f1.create(user, { email: "a@a.com" })).signal, "failed");
    assert.equal(
      f1
        .logs()
        .some(
          (entry) => entry.message === "database unavailable" && entry.fields.reason === "create",
        ),
      true,
    );
    assert.equal(
      f1.metrics().some((entry) => entry.name === "failuser.operation.failed"),
      true,
    );
    const stdoutLine = stdoutSpy.mock.calls
      .map((call) => String(call.arguments[0]))
      .find((line) => line.includes("database unavailable"));
    assert.ok(stdoutLine);
    const parsed = JSON.parse(String(stdoutLine).trim()) as Record<string, string>;
    assert.equal(parsed.level, "error");
    assert.equal(parsed.message, "database unavailable");
    assert.equal(parsed.reason, "create");
    assert.equal(parsed.model, "FailUser");
    assert.equal(parsed.operation, "create");
    stdoutSpy.mock.restore();

    db.mode = "ok";
    db.mode = "fail-connect";
    const f2 = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    assert.equal((await f2.create(user, { email: "b@b.com" })).signal, "failed");

    db.mode = "ok";
    db.mode = "fail-begin";
    const f3 = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    assert.equal((await f3.create(user, { email: "c@c.com" })).signal, "failed");

    db.mode = "ok";
    db.failOnSql = "ROLLBACK";
    const f4 = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    await f4.create(user, { email: "d@d.com" });
  });

  it("covers nested failures and running signals", async () => {
    const child = Model({
      name: "Child",
      fields: { t: Types.string },
      flow: flows({
        create: async () => Running,
        list: async () => Running,
        update: async () => Running,
        delete: async () => Running,
      }),
    });
    const user = Model({
      name: "Parent",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const missing = await flow.create({ name: "Missing" }, { t: "x" });
          if (missing.signal === "failed") {
            const nested = await flow.create(child, { t: "y" });
            return nested.signal;
          }
          return Failed;
        },
        async list(flow) {
          return (await flow.list({ name: "Missing" }, {})).signal;
        },
        async update(flow) {
          return (
            await flow.update(child, {
              id: "00000000-0000-7000-8000-000000000001",
              body: { t: "z" },
              filter: {},
            })
          ).signal;
        },
        async delete(flow) {
          return (
            await flow.delete(child, { id: "00000000-0000-7000-8000-000000000001", filter: {} })
          ).signal;
        },
      }),
    });
    const fookie = app({
      listen: String(port),
      database: "postgres://mock",
      models: [user, child],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: [db],
    });
    await fookie.create(user, { email: "p@p.com" });
    await fookie.list(user, {});
    await fookie.update(user, { id: "00000000-0000-7000-8000-000000000001", body: {}, filter: {} });
    await fookie.delete(user, { id: "00000000-0000-7000-8000-000000000001", filter: {} });
  });

  it("covers histogram and resume", async () => {
    const user = Model({
      name: "HistUser",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          flow.metric.histogram("latency", 42);
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
    await fookie.create(user, { email: "h@h.com" });
    const created = await fookie.create(user, { email: "h2@h.com" });
    assert.equal(created.signal, "done");
    assert.equal(
      fookie.metrics().some((m) => m.value === 42),
      true,
    );
  });
});
