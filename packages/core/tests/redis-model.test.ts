import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { app, Model, Done, Types, Failed } from "../src/index.ts";
import { MockDb, LiveApps } from "./mock-db.ts";
import { Postgres, Redis } from "./engines.ts";

class MemoryRedis {
  private readonly strings = new Map<string, string>();
  private readonly sets = new Map<string, Set<string>>();

  async connect(): Promise<boolean> {
    return true;
  }

  async get(key: string): Promise<readonly string[]> {
    const held = this.strings.get(key);
    if (held === undefined) {
      return [];
    }
    return [held];
  }

  async mGet(keys: readonly string[]): Promise<readonly (readonly string[])[]> {
    const rows: (readonly string[])[] = [];
    for (const key of keys) {
      rows.push(await this.get(key));
    }
    return rows;
  }

  async set(key: string, held: string): Promise<boolean> {
    this.strings.set(key, held);
    return true;
  }

  async del(key: string): Promise<boolean> {
    this.strings.delete(key);
    this.sets.delete(key);
    return true;
  }

  async sAdd(key: string, member: string): Promise<boolean> {
    const existing = this.sets.get(key);
    if (existing === undefined) {
      this.sets.set(key, new Set([member]));
      return true;
    }
    existing.add(member);
    return true;
  }

  async sRem(key: string, member: string): Promise<boolean> {
    const existing = this.sets.get(key);
    if (existing === undefined) {
      return true;
    }
    existing.delete(member);
    return true;
  }

  async sMembers(key: string): Promise<readonly string[]> {
    const existing = this.sets.get(key);
    if (existing === undefined) {
      return [];
    }
    return [...existing];
  }

  end: readonly (() => Promise<void>)[] = [];
}

function memoryRedis() {
  return Redis("redis://memory", [new MemoryRedis()]);
}

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

describe("a model on redis", () => {
  it("creates lists and filters with the same query surface as postgres", async () => {
    const reading = Model({
      name: "SensorReading",
      database: memoryRedis(),
      fields: { millivolts: z.number().int(), station: z.string() },
      flow: passthrough,
    });
    const db = new MockDb();
    const apps = new LiveApps();
    const fookie = apps.track(
      app({
        listen: "0",
        database: Postgres("postgres://mock", [db]),
        models: [reading],
        externals: [] as const,
        onExternalEvent: async () => {},
      }),
    );
    const created = await fookie.create(reading, { millivolts: 3300, station: "dock-1" });
    assert.equal(created.signal, Done);
    if (created.signal !== Done) {
      return;
    }
    const listed = await fookie.list(reading, { station: { eq: "dock-1" } });
    assert.equal(listed.signal, Done);
    assert.equal(listed.results.length, 1);
    for (const row of listed.results) {
      assert.equal(row.station, "dock-1");
      assert.equal(row.millivolts, 3300);
    }
    const missed = await fookie.list(reading, { station: { eq: "dock-9" } });
    assert.equal(missed.results.length, 0);
    await apps.shutdown();
  });

  it("keeps a relation to a postgres model and lists by that id", async () => {
    const probe = Model({
      name: "Probe",
      fields: { label: z.string() },
      flow: passthrough,
    });
    const sample = Model({
      name: "ProbeSample",
      database: memoryRedis(),
      fields: {
        probe: Types.relation({ name: "Probe" }),
        millivolts: z.number().int(),
      },
      flow: passthrough,
    });
    const db = new MockDb();
    const apps = new LiveApps();
    const fookie = apps.track(
      app({
        listen: "0",
        database: Postgres("postgres://mock", [db]),
        models: [probe, sample],
        externals: [] as const,
        onExternalEvent: async () => {},
      }),
    );
    const parent = await fookie.create(probe, { label: "alpha" });
    assert.equal(parent.signal, Done);
    if (parent.signal !== Done) {
      return;
    }
    const written = await fookie.create(sample, { probe: parent.id, millivolts: 12 });
    assert.equal(written.signal, Done);
    const listed = await fookie.list(sample, { probe: { eq: parent.id } });
    assert.equal(listed.signal, Done);
    assert.equal(listed.results.length, 1);
    for (const row of listed.results) {
      assert.equal(row.probe, parent.id);
    }
    const fkSql = db.queries.filter((sql) => sql.includes("FOREIGN KEY"));
    assert.equal(fkSql.length, 0, "a relation across stores is not a postgres foreign key");
    await apps.shutdown();
  });

  it("refuses raw sql on a redis model", async () => {
    const reading = Model({
      name: "SqlSensor",
      database: memoryRedis(),
      fields: { millivolts: z.number().int() },
      flow: {
        async create(flow) {
          try {
            await flow.pg.query("SELECT 1", []);
            return Failed;
          } catch (err) {
            assert.match(String(err), /postgres query/);
            return Done;
          }
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
    const db = new MockDb();
    const apps = new LiveApps();
    const fookie = apps.track(
      app({
        listen: "0",
        database: Postgres("postgres://mock", [db]),
        models: [reading],
        externals: [] as const,
        onExternalEvent: async () => {},
      }),
    );
    const created = await fookie.create(reading, { millivolts: 1 });
    assert.equal(created.signal, Done);
    await apps.shutdown();
  });

  it("orders and pages redis rows then deletes them", async () => {
    const reading = Model({
      name: "PagedSensor",
      database: memoryRedis(),
      fields: { millivolts: z.number().int(), station: z.string() },
      flow: passthrough,
    });
    const db = new MockDb();
    const apps = new LiveApps();
    const fookie = apps.track(
      app({
        listen: "0",
        database: Postgres("postgres://mock", [db]),
        models: [reading],
        externals: [] as const,
        onExternalEvent: async () => {},
      }),
    );
    await fookie.create(reading, { millivolts: 2, station: "a" });
    await fookie.create(reading, { millivolts: 9, station: "b" });
    const listed = await fookie.list(
      reading,
      {},
      { limit: [1], offset: [0], order: [{ field: "millivolts", direction: "desc" }] },
    );
    assert.equal(listed.signal, Done);
    assert.equal(listed.results.length, 1);
    for (const row of listed.results) {
      assert.equal(row.millivolts, 9);
    }
    const missing = await fookie.delete(reading, {
      id: "00000000-0000-4000-8000-000000000099",
      filter: {},
    });
    assert.equal(missing.signal, Failed);
    const doomed = await fookie.create(reading, { millivolts: 4, station: "c" });
    assert.equal(doomed.signal, Done);
    if (doomed.signal !== Done) {
      return;
    }
    const removed = await fookie.delete(reading, { id: doomed.id, filter: {} });
    assert.equal(removed.signal, Done);
    await apps.shutdown();
  });

  it("discards a redis create when the flow returns failed", async () => {
    const reading = Model({
      name: "FailSensor",
      database: memoryRedis(),
      fields: { millivolts: z.number().int() },
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
    const db = new MockDb();
    const apps = new LiveApps();
    const fookie = apps.track(
      app({
        listen: "0",
        database: Postgres("postgres://mock", [db]),
        models: [reading],
        externals: [] as const,
        onExternalEvent: async () => {},
      }),
    );
    const created = await fookie.create(reading, { millivolts: 1 });
    assert.equal(created.signal, Failed);
    const listed = await fookie.list(reading, {});
    assert.equal(listed.results.length, 0);
    await apps.shutdown();
  });

  it("hard-deletes redis rows when the store sets softDelete false", async () => {
    const driver = new MemoryRedis();
    const reading = Model({
      name: "HardSensor",
      database: Redis("redis://memory", [driver], { softDelete: false }),
      fields: { millivolts: z.number().int() },
      flow: passthrough,
    });
    const db = new MockDb();
    const apps = new LiveApps();
    const fookie = apps.track(
      app({
        listen: "0",
        database: Postgres("postgres://mock", [db]),
        models: [reading],
        externals: [] as const,
        onExternalEvent: async () => {},
      }),
    );
    const created = await fookie.create(reading, { millivolts: 9 });
    assert.equal(created.signal, Done);
    if (created.signal !== Done) {
      return;
    }
    const removed = await fookie.delete(reading, { id: created.id, filter: {} });
    assert.equal(removed.signal, Done);
    const listed = await fookie.list(reading, {});
    assert.equal(listed.results.length, 0);
    await apps.shutdown();
  });
});
