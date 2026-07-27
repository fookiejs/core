import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, Types, app } from "../src/index.ts";
import { MockDb, shutdownLiveApps, trackApp } from "./mock-db.ts";

const parent = Model({
  name: "IdxParent",
  fields: { title: z.string() },
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

const declared = Model({
  name: "IdxDeclared",
  fields: {
    owner: Types.relation({ name: "IdxParent" }),
    plain: z.string(),
    flagged: z.string().meta({ index: true }),
    only: z.string().meta({ unique: true }),
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

const nested = Model({
  name: "IdxNested",
  fields: { child: parent },
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

async function ddlFor(models: readonly Parameters<typeof app>[0]["models"][number][]) {
  const db = new MockDb();
  const port = 21000 + Math.floor(models.length);
  const fookie = trackApp(
    app({
      listen: String(port),
      database: "postgres://mock",
      models: models.slice(),
      externals: [] as const,
      onExternalEvent: async () => {},
      pool: [db],
    }),
  );
  await fookie.list(parent, {});
  return db.queries.filter(
    (sql) => sql.startsWith("CREATE INDEX") || sql.startsWith("CREATE UNIQUE"),
  );
}

async function constraintsFor(models: readonly Parameters<typeof app>[0]["models"][number][]) {
  const db = new MockDb();
  const fookie = trackApp(
    app({
      listen: "0",
      database: "postgres://mock",
      models: models.slice(),
      externals: [] as const,
      onExternalEvent: async () => {},
      pool: [db],
    }),
  );
  await fookie.list(parent, {});
  return db.queries.filter((sql) => sql.includes("ADD CONSTRAINT"));
}

describe("relation foreign keys", () => {
  it("emits a deferred restrict constraint for a declared relation", async () => {
    const constraints = await constraintsFor([parent, declared]);
    assert.equal(constraints.length, 1);
    for (const sql of constraints) {
      assert.match(sql, /ADD CONSTRAINT idx_declared_owner_fk/);
      assert.match(sql, /REFERENCES public\.idx_parent \(id\)/);
      assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/);
      assert.match(sql, /ON DELETE RESTRICT/);
    }
    await shutdownLiveApps();
  });

  it("emits one for a nested model reference too", async () => {
    const constraints = await constraintsFor([parent, nested]);
    assert.equal(constraints.length, 1);
    for (const sql of constraints) {
      assert.match(sql, /ADD CONSTRAINT idx_nested_child_fk/);
      assert.match(sql, /REFERENCES public\.idx_parent \(id\)/);
    }
    await shutdownLiveApps();
  });

  it("emits none for a model without relations", async () => {
    const constraints = await constraintsFor([parent]);
    assert.equal(constraints.length, 0);
    await shutdownLiveApps();
  });
});

describe("relation indexes", () => {
  it("indexes a declared relation column without being asked", async () => {
    const indexes = await ddlFor([parent, declared]);
    assert.ok(
      indexes.includes(
        "CREATE INDEX IF NOT EXISTS idx_declared_owner_idx ON public.idx_declared (owner)",
      ),
    );
    await shutdownLiveApps();
  });

  it("indexes a nested model reference column", async () => {
    const indexes = await ddlFor([parent, nested]);
    assert.ok(indexes.some((sql) => sql.includes("idx_nested") && sql.includes("(child)")));
    await shutdownLiveApps();
  });

  it("leaves an unflagged scalar column unindexed", async () => {
    const indexes = await ddlFor([parent, declared]);
    assert.equal(
      indexes.some((sql) => sql.includes("(plain)")),
      false,
    );
    assert.ok(indexes.some((sql) => sql.startsWith("CREATE INDEX") && sql.includes("(flagged)")));
    assert.ok(indexes.some((sql) => sql.startsWith("CREATE UNIQUE") && sql.includes("(only)")));
    await shutdownLiveApps();
  });
});
