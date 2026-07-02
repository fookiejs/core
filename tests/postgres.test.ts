import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { app, Model, External, Types, Done, flows } from "../src/index.ts";

const databaseUrl = process.env.FOOKIE_TEST_DATABASE ?? "";

const scoreExt = External({
  name: "fraud.score",
  input: { amount: Types.currency },
  output: { score: Types.int },
  attempts: 1,
  backoff: "fixed",
});

describe("postgres integration", { skip: databaseUrl.length === 0 }, () => {
  let pool: pg.Pool;

  before(() => {
    pool = new pg.Pool({ connectionString: databaseUrl });
  });

  after(async () => {
    await pool.end();
  });

  it("persists create and list against real postgres", async () => {
    const user = Model({
      name: "PgUser",
      fields: { email: Types.email.unique(), name: Types.string.index() },
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
      listen: "0",
      database: databaseUrl,
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool,
    });

    const email = `pg-${Date.now()}@example.com`;
    const created = await fookie.create(user, { email, name: "Pg" });
    assert.equal(created.signal, "done");
    if (created.signal !== "done") {
      return;
    }

    const listed = await fookie.list(user, { email: { eq: email } });
    assert.equal(listed, "done");
    assert.equal(
      fookie.listResults().some((row) => row.email === email),
      true,
    );
  });

  it("filters coordinates with near against real postgres", async () => {
    const place = Model({
      name: "PgPlace",
      fields: { title: Types.string, loc: Types.coordinate },
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
      listen: "0",
      database: databaseUrl,
      models: [place],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool,
    });

    const title = `hq-${Date.now()}`;
    const created = await fookie.create(place, { title, loc: [29, 41] });
    assert.equal(created.signal, "done");

    const nearHit = await fookie.list(place, { loc: { near: [29.0005, 41.0005, 1] } });
    assert.equal(nearHit, "done");
    assert.equal(
      fookie.listResults().some((row) => row.title === title),
      true,
    );

    const nearMiss = await fookie.list(place, { loc: { near: [50, 50, 1] } });
    assert.equal(nearMiss, "done");
    assert.equal(
      fookie.listResults().some((row) => row.title === title),
      false,
    );
  });
});
