import { z } from "zod";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  Done,
  External,
  Model,
  OutboxCompleted,
  OutboxFailed,
  OutboxPending,
  Types,
  app,
} from "../src/index.ts";
import {
  MockDb,
  httpPost,
  httpSocketDrop,
  LiveApps,
  serveApp,
} from "./mock-db.ts";
import { Postgres } from "./engines.ts";

let nextPort = 46000;

const scoreExt = External({
  name: "fraud.score",
  input: { amount: z.number().finite().nonnegative() },
  output: { score: z.number().int() },
  attempts: 1,
  backoff: "fixed",
  timeoutMs: 30_000,
});

describe("filter and http branches", () => {
  let db: MockDb;
  let apps: LiveApps;
  let port: number;

  beforeEach(() => {
    db = new MockDb();
    apps = new LiveApps();
    port = nextPort;
    nextPort += 10;
  });

  afterEach(async () => {
    await apps.shutdown();
  });

  it("exercises disabled runtime filter ops per field group", async () => {
    const buyer = Model({
      name: "Buyer",
      fields: { email: z.string().email() },
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

    const full = Model({
      name: "FullFilter",
      fields: {
        email: z.string().email(),
        score: z.number().int(),
        buyer,
        active: z.boolean(),
        point: Types.coordinate,
        meta: Types.jsonb,
        blob: Types.bytea,
        shape: Types.line,
      },
      flow: {
        async create() {
          return Done;
        },
        async list(flow) {
          flow.filter.buyer.gt("x");
          flow.filter.buyer.gte("x");
          flow.filter.buyer.lt("x");
          flow.filter.buyer.lte("x");
          flow.filter.buyer.like("x");
          flow.filter.buyer.ilike("x");
          flow.filter.buyer.startsWith("x");
          flow.filter.buyer.endsWith("x");
          flow.filter.buyer.contains("x");
          flow.filter.buyer.near(0, 0, 5);
          flow.filter.active.gt(1);
          flow.filter.active.gte(1);
          flow.filter.active.lt(1);
          flow.filter.active.lte(1);
          flow.filter.active.like("t");
          flow.filter.active.in([true]);
          flow.filter.active.contains("x");
          flow.filter.active.near(0, 0, 1);
          flow.filter.point.gt(1);
          flow.filter.point.like("x");
          flow.filter.point.in([[1, 2]]);
          flow.filter.point.contains("x");
          flow.filter.point.near(1, 2, 3);
          flow.filter.meta.gt(1);
          flow.filter.meta.like("x");
          flow.filter.meta.in(["{}"]);
          flow.filter.meta.near(0, 0, 1);
          flow.filter.meta.contains("{");
          flow.filter.blob.gt(1);
          flow.filter.blob.like("x");
          flow.filter.blob.in(["00"]);
          flow.filter.blob.contains("x");
          flow.filter.blob.near(0, 0, 1);
          flow.filter.shape.gt(1);
          flow.filter.shape.like("x");
          flow.filter.shape.contains("x");
          flow.filter.shape.near(0, 0, 1);
          flow.filter.email.near(0, 0, 5);
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

    const fookie = app({
      listen: String(port),
      database: Postgres("postgres://mock", [db]),
      models: [buyer, full],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
    });

    const created = await fookie.create(buyer, { email: "b@f.com" });
    if (created.signal !== "done") {
      return;
    }

    await fookie.create(full, {
      email: "f@f.com",
      score: 10,
      buyer: created.id,
      active: true,
      point: [2, 3],
      meta: "{}",
      blob: "\\x00",
      shape: "{1,0,-1}",
    });

    await fookie.list(full, {
      email: { eq: "f@f.com", in: [] },
      score: { gt: 1, gte: 1, lt: 100, lte: 100 },
      meta: { contains: "{}" },
      point: { near: [0, 0, 10] },
    });
  });

  it("rejects http filters carrying invalid operators", async () => {
    const user = Model({
      name: "HttpFilter",
      fields: { email: z.string().email(), score: z.number().int(), meta: Types.jsonb },
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

    const fookie = apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [user],
        externals: [scoreExt] as const,
        onExternalEvent: async () => {},
      }),
    );
    await serveApp(fookie);

    await fookie.create(user, { email: "h@f.com", score: 1, meta: "{}" });
    await fookie.list(user, { email: { eq: "h@f.com", in: [] } });

    const invalid = await httpPost(port, "/httpfilter/list", {
      filter: { email: { eq: 1 } },
    });
    assert.equal(invalid.status, 400);

    const junk = await httpPost(port, "/httpfilter/list", {
      filter: {
        email: { eq: "h@f.com", ne: {}, in: [1, 2, 3], like: false },
        score: { gt: "bad" },
      },
    });
    assert.equal(junk.status, 400);

    const clean = await httpPost(port, "/httpfilter/list", {
      filter: { email: { eq: "h@f.com" } },
    });
    assert.equal(clean.status, 200);
  });

  it("covers pg parse branches and outbox json skips", async () => {
    const user = Model({
      name: "PgParse",
      fields: {
        email: z.string().email(),
        score: z.number().int(),
        active: z.boolean(),
        point: Types.coordinate,
      },
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

    db.outbox.set("mix", {
      external_id: "mix",
      name: "fraud.score",
      status: OutboxCompleted,
      input: { amount: 1, junk: { nested: true } },
      output: { score: 1, junk: [1, 2, 3] },
      entity_id: "e",
      model: "PgParse",
      run_id: "r",
      attempt: 1,
    });

    const fookie = app({
      listen: String(port),
      database: Postgres("postgres://mock", [db]),
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
    });

    const created = await fookie.create(user, {
      email: "p@p.com",
      score: 7,
      active: true,
      point: [4, 5],
    });
    if (created.signal !== "done") {
      return;
    }

    const table = "pg_parse";
    db.rows.get(table)?.set(created.id, {
      id: created.id,
      email: "p@p.com",
      score: "not-a-number",
      active: "t",
      point: "not-a-point",
      created_at: "2020-01-01T00:00:00.000",
      updated_at: "2020-01-01T00:00:00.000",
      is_deleted: false,
    });

    const fookie2 = app({
      listen: String(port + 1),
      database: Postgres("postgres://mock", [db]),
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
    });

    await fookie2.list(user, { email: { eq: "p@p.com" } });
    await fookie2.update(
      user,
      { id: { eq: created.id }, email: { eq: "p@p.com" } },
      { point: [6, 7] },
    );
  });

  it("covers http external success and request abort", async () => {
    const user = Model({
      name: "ExtHttp",
      fields: { email: z.string().email() },
      flow: {
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
      },
    });

    const events: { externalId: string }[] = [];
    const fookie = apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [user],
        externals: [scoreExt] as const,
        onExternalEvent: async (event) => {
          events.push(event);
        },
      }),
    );
    await serveApp(fookie);

    const pending = await fookie.create(user, { email: "e@h.com" });
    if (pending.signal !== "running") {
      return;
    }
    const externalId = events[0]?.externalId ?? "";
    const ok = await fookie.setExternalResult({
      externalId,
      output: { score: 2 },
    });
    assert.equal(ok, true);

    const dropped = await httpSocketDrop(port, "/exthttp/list");
    assert.equal(dropped, 400);
  });

  it("resolves external resume model by name when run is missing", async () => {
    const user = Model({
      name: "GhostResume",
      fields: { email: z.string().email() },
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

    db.outbox.set("ghost2", {
      external_id: "ghost2",
      name: "fraud.score",
      status: OutboxPending,
      input: { amount: 3 },
      output: null,
      entity_id: "e",
      model: "GhostResume",
      run_id: "missing",
      attempt: 1,
    });

    const fookie = app({
      listen: String(port),
      database: Postgres("postgres://mock", [db]),
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
    });

    await fookie.list(user, {});
    assert.equal(
      await fookie.setExternalResult({ externalId: "ghost2", output: { score: 1 } }),
      true,
    );
  });

  it("returns failed from http create and skips resume for unknown model", async () => {
    const failUser = Model({
      name: "HttpFail",
      fields: { email: z.string().email() },
      flow: {
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
      },
    });

    const known = Model({
      name: "Known",
      fields: { email: z.string().email() },
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

    const fookie = apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [failUser, known],
        externals: [scoreExt] as const,
        onExternalEvent: async () => {},
      }),
    );
    await serveApp(fookie);

    const failed = await httpPost(port, "/httpfail/create", {
      body: { email: "fail@f.com" },
    });
    assert.equal(failed.status, 200);
    assert.equal(failed.json.signal, "failed");

    db.outbox.set("orphan", {
      external_id: "orphan",
      name: "fraud.score",
      status: OutboxPending,
      input: { amount: 2 },
      output: null,
      entity_id: "e",
      model: "UnknownModel",
      run_id: "missing",
      attempt: 1,
    });

    const fookie2 = app({
      listen: String(port + 1),
      database: Postgres("postgres://mock", [db]),
      models: [known],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
    });

    await fookie2.list(known, {});
    assert.equal(
      await fookie2.setExternalResult({ externalId: "orphan", output: { score: 2 } }),
      true,
    );
  });
});
