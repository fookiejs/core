import { z } from "zod";
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, External, Model, Types, app } from "../src/index.ts";
import { MockDb, LiveApps } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const release = External({
  name: "cat.release",
  input: { hold: z.string() },
  output: { freed: z.boolean() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const reserve = External({
  name: "cat.reserve",
  input: { sku: z.string() },
  output: { hold: z.string() },
  attempts: 3,
  backoff: "exponential",
  timeoutMs: 15_000,
  compensate: release,
});

const owner = Model({
  name: "CatOwner",
  fields: { email: z.string().email().meta({ unique: true }) },
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

const note = Model({
  name: "CatNote",
  fields: {
    title: z.string().meta({ index: true }),
    body: z.string(),
    author: Types.relation({ name: "CatOwner" }),
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

function fieldsByKey(
  fields: readonly {
    key: string;
    relation: readonly string[];
    pgType: string;
    index: boolean;
    system: boolean;
  }[],
) {
  const byKey = new Map<string, (typeof fields)[number]>();
  for (const field of fields) {
    byKey.set(field.key, field);
  }
  return byKey;
}

function isNote(entry: { name: string }): boolean {
  return entry.name === "CatNote";
}

function isOwner(entry: { name: string }): boolean {
  return entry.name === "CatOwner";
}

function isEmailField(field: { key: string }): boolean {
  return field.key === "email";
}

function isReserve(entry: { name: string }): boolean {
  return entry.name === "cat.reserve";
}

function isRelease(entry: { name: string }): boolean {
  return entry.name === "cat.release";
}

describe("catalog and raw sql", () => {
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
        models: [owner, note],
        externals: [reserve, release] as const,
        onExternalEvent: async () => {},
      }),
    );
  }

  it("describes every model, its table and its fields", async () => {
    const fookie = boot();
    const summaries = fookie.catalog();
    assert.equal(summaries.length, 2);

    const noteSummary = summaries.filter(isNote);
    assert.equal(noteSummary.length, 1);
    for (const summary of noteSummary) {
      assert.equal(summary.table, "cat_note");
      const byKey = fieldsByKey(summary.fields);
      assert.deepEqual(byKey.get("author")?.relation, ["CatOwner"]);
      assert.equal(byKey.get("author")?.pgType, "UUID");
      assert.equal(byKey.get("title")?.index, true);
      assert.deepEqual(byKey.get("title")?.relation, []);
      assert.equal(byKey.get("body")?.index, false);
      assert.equal(byKey.get("id")?.system, true);
      assert.equal(byKey.get("body")?.system, false);
    }
    await apps.shutdown();
  });

  it("reports unique from field metadata", async () => {
    const fookie = boot();
    for (const summary of fookie.catalog().filter(isOwner)) {
      const email = summary.fields.filter(isEmailField);
      assert.equal(email.length, 1);
      for (const field of email) {
        assert.equal(field.unique, true);
        assert.equal(field.column, "email");
      }
    }
    await apps.shutdown();
  });

  it("describes externals including their retry policy and undo", async () => {
    const fookie = boot();
    const summaries = fookie.externalCatalog();
    assert.equal(summaries.length, 2);

    for (const summary of summaries.filter(isReserve)) {
      assert.equal(summary.attempts, 3);
      assert.equal(summary.backoff, "exponential");
      assert.equal(summary.timeoutMs, 15_000);
      assert.deepEqual(summary.inputKeys, ["sku"]);
      assert.deepEqual(summary.outputKeys, ["hold"]);
      assert.deepEqual(summary.compensate, ["cat.release"]);
    }
    for (const summary of summaries.filter(isRelease)) {
      assert.deepEqual(summary.compensate, []);
    }
    await apps.shutdown();
  });

  it("hands out no executable capability", async () => {
    const fookie = boot();
    for (const summary of fookie.catalog()) {
      assert.equal("flow" in summary, false, "a summary must not carry the flow handlers");
      assert.equal("validateCreateBody" in summary, false);
    }
    for (const summary of fookie.externalCatalog()) {
      assert.equal("validateInput" in summary, false);
      assert.equal("validateOutput" in summary, false);
    }
    await apps.shutdown();
  });

  it("runs a parameterised statement and binds the data", async () => {
    const fookie = boot();
    await fookie.create(owner, { email: "sql@x.com" });

    db.queries.length = 0;
    await fookie.sql("SELECT * FROM public.cat_owner WHERE email = $1", ["sql@x.com"]);
    assert.equal(db.queries.length, 1);
    for (const sql of db.queries) {
      assert.match(sql, /\$1/, "the value must be bound, not interpolated");
      assert.equal(sql.includes("sql@x.com"), false);
    }
    await apps.shutdown();
  });

  it("refuses an empty statement", async () => {
    const fookie = boot();
    await assert.rejects(() => fookie.sql("", []));
    await apps.shutdown();
  });
});
