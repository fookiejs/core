import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, Types, app } from "../src/index.ts";
import { MockDb, LiveApps } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

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
  const apps = new LiveApps();
  const port = 21000 + Math.floor(models.length);
  const fookie = apps.track(
    app({
      listen: String(port),
      database: Postgres("postgres://mock", [db]),
      models: models.slice(),
      externals: [] as const,
      onExternalEvent: async () => {},
    }),
  );
  await fookie.list(parent, {});
  const indexes = db.queries.filter(
    (sql) => sql.startsWith("CREATE INDEX") || sql.startsWith("CREATE UNIQUE"),
  );
  await apps.shutdown();
  return indexes;
}

async function constraintsFor(models: readonly Parameters<typeof app>[0]["models"][number][]) {
  const db = new MockDb();
  const apps = new LiveApps();
  const fookie = apps.track(
    app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: models.slice(),
      externals: [] as const,
      onExternalEvent: async () => {},
    }),
  );
  await fookie.list(parent, {});
  const constraints = db.queries.filter((sql) => sql.includes("ADD CONSTRAINT"));
  await apps.shutdown();
  return constraints;
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
  });

  it("emits one for a nested model reference too", async () => {
    const constraints = await constraintsFor([parent, nested]);
    assert.equal(constraints.length, 1);
    for (const sql of constraints) {
      assert.match(sql, /ADD CONSTRAINT idx_nested_child_fk/);
      assert.match(sql, /REFERENCES public\.idx_parent \(id\)/);
    }
  });

  it("emits none for a model without relations", async () => {
    const constraints = await constraintsFor([parent]);
    assert.equal(constraints.length, 0);
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
  });

  it("indexes a nested model reference column", async () => {
    const indexes = await ddlFor([parent, nested]);
    assert.ok(indexes.some((sql) => sql.includes("idx_nested") && sql.includes("(child)")));
  });

  it("leaves an unflagged scalar column unindexed", async () => {
    const indexes = await ddlFor([parent, declared]);
    assert.equal(
      indexes.some((sql) => sql.includes("(plain)")),
      false,
    );
    assert.ok(indexes.some((sql) => sql.startsWith("CREATE INDEX") && sql.includes("(flagged)")));
    assert.ok(indexes.some((sql) => sql.startsWith("CREATE UNIQUE") && sql.includes("(only)")));
  });
});
