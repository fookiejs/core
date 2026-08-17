import { z } from "zod";
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, Types, app } from "../src/index.ts";
import { MockDb, LiveApps } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const declaredNote = Model({
  name: "ScopeDeclaredNote",
  fields: { title: z.string(), owner: Types.relation({ name: "ScopeParent" }) },
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

const parent = Model({
  name: "ScopeParent",
  fields: { email: z.string().email() },
  flow: {
    async create(flow) {
      const child = await flow.create(declaredNote, { title: "t", owner: flow.id });
      return child.signal;
    },
    async list(flow) {
      const nested = await flow.list(declaredNote, {});
      return nested.signal;
    },
    async update() {
      return Done;
    },
    async delete() {
      return Done;
    },
  },
});

const boundNote = Model({
  name: "ScopeBoundNote",
  fields: { title: z.string(), owner: Types.relation({ name: "ScopeBoundParent" }) },
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

const boundParent = Model({
  name: "ScopeBoundParent",
  fields: { email: z.string().email() },
  flow: {
    async create(flow) {
      const child = await flow.create(boundNote, { title: "bound" });
      return child.signal;
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

describe("Types.relation parent scoping", () => {
  let db: MockDb;
  let apps: LiveApps;

  beforeEach(() => {
    db = new MockDb();
    apps = new LiveApps();
  });

  function boot(models: Parameters<typeof app>[0]["models"]) {
    return apps.track(
      app({
        listen: "0",
        database: Postgres("postgres://mock", [db]),
        models,
        externals: [] as const,
        onExternalEvent: async () => {},
      }),
    );
  }

  it("scopes a nested list to the parent that asked for it", async () => {
    const fookie = boot([parent, declaredNote]);
    const created = await fookie.create(parent, { email: "scope@x.com" });
    assert.equal(created.signal, "done");

    db.queries.length = 0;
    const listed = await fookie.list(parent, {});
    assert.equal(listed.signal, "done");

    const childSelects = db.queries.filter((sql) =>
      sql.startsWith("SELECT * FROM public.scope_declared_note"),
    );
    assert.equal(childSelects.length, 1, "the nested list issued one query");
    for (const sql of childSelects) {
      assert.match(sql, /\bowner = \$\d+/, `nested list must scope by owner, got: ${sql}`);
    }
    await apps.shutdown();
  });

  it("binds the parent id into a nested create body", async () => {
    const fookie = boot([boundParent, boundNote]);
    const created = await fookie.create(boundParent, { email: "bound@x.com" });
    assert.equal(created.signal, "done");
    if (created.signal !== "done") {
      throw new Error("parent create must succeed");
    }

    const childRows = [...(db.rows.get("scope_bound_note")?.values() ?? [])];
    assert.equal(childRows.length, 1);
    for (const row of childRows) {
      assert.equal(row.owner, created.id, "the child must point at its parent");
    }
    await apps.shutdown();
  });
});
