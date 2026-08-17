import { z } from "zod";
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, app } from "../src/index.ts";
import { MockDb, LiveApps } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const note = Model({
  name: "PageNote",
  fields: { title: z.string(), rank: z.number().int() },
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

function selectsFrom(queries: readonly string[]): readonly string[] {
  const found: string[] = [];
  for (const sql of queries) {
    if (sql.startsWith("SELECT * FROM public.page_note")) {
      found.push(sql);
    }
  }
  return found;
}

describe("list paging", () => {
  let db: MockDb;
  let apps: LiveApps;

  beforeEach(() => {
    db = new MockDb();
    apps = new LiveApps();
  });

  function boot() {
    return apps.track(
      app({
        listen: "0",
        database: Postgres("postgres://mock", [db]),
        models: [note],
        externals: [] as const,
        onExternalEvent: async () => {},
      }),
    );
  }

  it("orders by id alone when nothing is asked for", async () => {
    const fookie = boot();
    await fookie.list(note, {});
    const selects = selectsFrom(db.queries);
    assert.equal(selects.length, 1);
    for (const sql of selects) {
      assert.match(sql, /ORDER BY id ASC$/);
      assert.equal(sql.includes("LIMIT"), false);
      assert.equal(sql.includes("OFFSET"), false);
    }
    await apps.shutdown();
  });

  it("emits the requested order with id as a stable tiebreak", async () => {
    const fookie = boot();
    await fookie.list(
      note,
      {},
      { limit: [], offset: [], order: [{ field: "rank", direction: "desc" }] },
    );
    for (const sql of selectsFrom(db.queries)) {
      assert.match(sql, /ORDER BY rank DESC, id ASC$/);
    }
    await apps.shutdown();
  });

  it("binds limit and offset instead of interpolating them", async () => {
    const fookie = boot();
    await fookie.list(note, {}, { limit: [25], offset: [50], order: [] });
    for (const sql of selectsFrom(db.queries)) {
      assert.match(sql, /LIMIT \$1 OFFSET \$2$/);
      assert.equal(sql.includes("25"), false);
      assert.equal(sql.includes("50"), false);
    }
    await apps.shutdown();
  });

  it("numbers page parameters after the filter parameters", async () => {
    const fookie = boot();
    await fookie.list(note, { title: { eq: "x" } }, { limit: [5], offset: [], order: [] });
    for (const sql of selectsFrom(db.queries)) {
      assert.match(sql, /title = \$1/);
      assert.match(sql, /LIMIT \$2$/);
    }
    await apps.shutdown();
  });

  it("rejects an order field that is not on the model", async () => {
    const fookie = boot();
    const listed = await fookie.list(
      note,
      {},
      { limit: [], offset: [], order: [{ field: "title; DROP TABLE x", direction: "asc" }] },
    );
    assert.equal(listed.signal, "failed");
    assert.equal(selectsFrom(db.queries).length, 0, "no statement may be issued");
    await apps.shutdown();
  });

  it("rejects a negative limit", async () => {
    const fookie = boot();
    const listed = await fookie.list(note, {}, { limit: [-1], offset: [], order: [] });
    assert.equal(listed.signal, "failed");
    assert.equal(selectsFrom(db.queries).length, 0);
    await apps.shutdown();
  });
});
