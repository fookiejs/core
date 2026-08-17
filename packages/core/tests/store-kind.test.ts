import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseError, Done, Model, StoreRegistry, Types, ValidationError, collectDatabases, modelDatabaseOf, openBinding, sameStore, storeKindOf } from "../src/index.ts";
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

function sensorModel() {
  return Model({
    name: "RedisStoreSensor",
    database: Redis("redis://memory"),
    fields: {
      millivolts: Types.int.unique(),
      station: Types.text.unique(),
      note: z.string(),
    },
    flow: passthrough,
  });
}

function pgModel() {
  return Model({
    name: "RedisStoreProbe",
    fields: { label: z.string() },
    flow: passthrough,
  });
}

describe("store kind and registry", () => {
  it("recognizes postgres and redis url families", () => {
    assert.equal(storeKindOf(Postgres("postgres://x")), "postgres");
    assert.equal(storeKindOf(Postgres("postgresql://x")), "postgres");
    assert.equal(storeKindOf(Redis("redis://x")), "redis");
    assert.equal(storeKindOf(Redis("rediss://x")), "redis");
    assert.throws(() => Postgres("mysql://x"), ValidationError);
    assert.throws(() => Redis(""), ValidationError);
  });

  it("collects inherited and pinned databases", () => {
    const parent = pgModel();
    const child = sensorModel();
    assert.equal(modelDatabaseOf(parent, mockPg).key, "postgres://mock");
    assert.equal(modelDatabaseOf(child, mockPg).key, "redis://memory");
    assert.equal(sameStore(parent, child, mockPg), false);
    assert.equal(sameStore(parent, parent, mockPg), true);
    const engines = collectDatabases([parent, child, child], mockPg);
    assert.equal(engines.length, 2);
    assert.equal(engines[0]?.key, "postgres://mock");
    assert.equal(engines[1]?.key, "redis://memory");
  });

  it("opens injected postgres and a second owned postgres url", async () => {
    const registry = StoreRegistry.open([], mockPg, []);
    const fallback = registry.defaultStore(mockPg);
    assert.equal(registry.all().length, 1);
    assert.equal(registry.lookup("postgres://mock").length, 1);
    assert.throws(() => registry.require("redis://missing"), DatabaseError);
    assert.equal(registry.lookup("").length, 0);
    assert.throws(() => Postgres(""), ValidationError);
    const sensors = Postgres("postgres://sensors");
    const owned = openBinding(sensors, []);
    assert.equal(owned.database, "postgres://sensors");
    for (const close of owned.close) {
      await close();
    }
    const redisEngine = Redis("redis://127.0.0.1:1");
    const redisBinding = openBinding(redisEngine, []);
    assert.equal(redisBinding.database, "redis://127.0.0.1:1");
    for (const close of redisBinding.close) {
      await close();
    }
    assert.ok(fallback);
  });

  it("rejects an empty model database parameter", () => {
    assert.throws(() => Postgres(""), ValidationError);
  });
});
