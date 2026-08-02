import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, app } from "../src/index.ts";
import { MockDb } from "./mock-db.ts";

const widget = Model({
  name: "ReadyWidget",
  fields: { label: z.string() },
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

function boot(db: MockDb) {
  return app({
    listen: "0",
    database: "postgres://mock",
    models: [widget],
    externals: [] as const,
    onExternalEvent: async () => {},
    pool: [db],
  });
}

function createCount(queries: readonly string[]): number {
  let seen = 0;
  for (const sql of queries) {
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS public.ready_widget")) {
      seen = seen + 1;
    }
  }
  return seen;
}

describe("schema readiness", () => {
  it("syncs once no matter how many callers arrive together", async () => {
    const db = new MockDb();
    db.ddlDelayMs = 30;
    const fookie = boot(db);

    const settled = await Promise.all([
      fookie.list(widget, {}),
      fookie.list(widget, {}),
      fookie.create(widget, { label: "a" }),
      fookie.ready(),
    ]);
    for (const outcome of settled.slice(0, 3)) {
      assert.notEqual(outcome, undefined);
    }
    assert.equal(
      createCount(db.queries),
      1,
      "a cold app must not run its DDL once per concurrent caller",
    );

    await fookie.stop();
  });

  it("reports readiness without being asked to do any work", async () => {
    const db = new MockDb();
    const fookie = boot(db);

    assert.equal(await fookie.ready(), true);
    assert.equal(createCount(db.queries), 1);
    assert.equal(await fookie.ready(), true, "a ready app answers from memory");
    assert.equal(createCount(db.queries), 1, "readiness is not re-checked once established");

    await fookie.stop();
  });

  it("bounds how long the schema sync will wait for a lock", async () => {
    const db = new MockDb();
    const fookie = boot(db);

    await fookie.ready();
    const timeouts = db.queries.filter((sql) => sql.startsWith("SET lock_timeout"));
    assert.equal(timeouts.length, 1, "the DDL session must bound its own lock wait");
    for (const sql of timeouts) {
      assert.match(sql, /SET lock_timeout = \d+/);
    }

    await fookie.stop();
  });

  it("lets a caller retry after the first sync fails", async () => {
    const db = new MockDb();
    db.mode = "fail-create-table";
    const fookie = boot(db);

    assert.equal(await fookie.ready(), false, "a broken database is not ready");
    db.mode = "ok";
    assert.equal(await fookie.ready(), true, "the next attempt is allowed to try again");

    await fookie.stop();
  });
});
