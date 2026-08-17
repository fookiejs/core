import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, Types } from "../src/index.ts";
import { modelForeignKeyStatements } from "../../postgresql/src/ddl.ts";
import { mockPg, Postgres, Redis } from "./engines.ts";

const passthrough = {
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
};

const sensors = Postgres("postgres://sensors");
const cache = Redis("redis://localhost:6379");

const parent = Model({
  name: "DbParent",
  fields: { email: z.string().email() },
  flow: passthrough,
});

const childSame = Model({
  name: "DbChildSame",
  fields: { title: z.string(), owner: Types.relation({ name: "DbParent" }) },
  flow: passthrough,
});

const childOther = Model({
  name: "DbChildOther",
  database: sensors,
  fields: { title: z.string(), owner: Types.relation({ name: "DbParent" }) },
  flow: passthrough,
});

const childRedis = Model({
  name: "DbChildRedis",
  database: cache,
  fields: { title: z.string(), owner: Types.relation({ name: "DbParent" }) },
  flow: passthrough,
});

describe("model database", () => {
  it("inherits the app database when the parameter is omitted", () => {
    assert.deepEqual(parent.database, []);
    assert.deepEqual(childSame.database, []);
  });

  it("pins a store with a single database parameter", () => {
    assert.equal(childOther.database.length, 1);
    assert.equal(childRedis.database.length, 1);
    for (const engine of childOther.database) {
      assert.equal(engine.key, "postgres://sensors");
    }
    for (const engine of childRedis.database) {
      assert.equal(engine.key, "redis://localhost:6379");
    }
  });

  it("still declares a deferrable foreign key when both models share a postgres url", () => {
    const statements = modelForeignKeyStatements(childSame, [parent, childSame], mockPg);
    assert.equal(statements.length, 1);
    for (const sql of statements) {
      assert.match(sql, /FOREIGN KEY/);
      assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/);
    }
  });

  it("does not declare a foreign key across different postgres urls", () => {
    const statements = modelForeignKeyStatements(childOther, [parent, childOther], mockPg);
    assert.equal(statements.length, 0);
  });

  it("does not declare a foreign key onto redis", () => {
    const statements = modelForeignKeyStatements(childRedis, [parent, childRedis], mockPg);
    assert.equal(statements.length, 0);
  });
});
