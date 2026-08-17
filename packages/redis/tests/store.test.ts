import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DatabaseError,
  Done,
  Model,
  NotFoundError,
  OutboxCompleted,
  OutboxPending,
  Phase,
  Types,
  emptyFilterInput,
} from "@fookiejs/core";
import type { OutboxEntry, RunStateWrite } from "@fookiejs/core";
import { Postgres } from "@fookiejs/postgresql";
import {
  compareOutboxOrder,
  compareRunOrder,
  compareText,
  parseOutbox,
  parseRun,
  slicePage,
} from "../src/codec.ts";
import type { RedisDriver } from "../src/driver.ts";
import { entityKey, liveKey, uniqueKey, uniqueText } from "../src/keys.ts";
import { Redis } from "../src/index.ts";
import { RedisStore } from "../src/store.ts";

const mockPg = Postgres("postgres://mock");

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

class MemoryDriver {
  private readonly strings = new Map<string, string>();
  private readonly sets = new Map<string, Set<string>>();
  failConnect = false;
  boom = false;
  getCalls = 0;
  mGetCalls = 0;

  async connect(): Promise<boolean> {
    if (this.failConnect === true) {
      return false;
    }
    if (this.boom === true) {
      throw new Error("redis down");
    }
    return true;
  }

  async get(key: string): Promise<readonly string[]> {
    this.getCalls = this.getCalls + 1;
    this.explode();
    const held = this.strings.get(key);
    if (held === undefined) {
      return [];
    }
    return [held];
  }

  async mGet(keys: readonly string[]): Promise<readonly (readonly string[])[]> {
    this.mGetCalls = this.mGetCalls + 1;
    const rows: (readonly string[])[] = [];
    for (const key of keys) {
      rows.push(await this.getWithoutCount(key));
    }
    return rows;
  }

  private async getWithoutCount(key: string): Promise<readonly string[]> {
    this.explode();
    const held = this.strings.get(key);
    if (held === undefined) {
      return [];
    }
    return [held];
  }

  async set(key: string, held: string): Promise<boolean> {
    this.explode();
    this.strings.set(key, held);
    return true;
  }

  async del(key: string): Promise<boolean> {
    this.explode();
    this.strings.delete(key);
    this.sets.delete(key);
    return true;
  }

  async sAdd(key: string, member: string): Promise<boolean> {
    this.explode();
    const existing = this.sets.get(key);
    if (existing === undefined) {
      this.sets.set(key, new Set([member]));
      return true;
    }
    existing.add(member);
    return true;
  }

  async sRem(key: string, member: string): Promise<boolean> {
    this.explode();
    const existing = this.sets.get(key);
    if (existing === undefined) {
      return true;
    }
    existing.delete(member);
    return true;
  }

  async sMembers(key: string): Promise<readonly string[]> {
    this.explode();
    const existing = this.sets.get(key);
    if (existing === undefined) {
      return [];
    }
    return [...existing];
  }

  explode(): void {
    if (this.boom === true) {
      throw new Error("redis down");
    }
  }

  end: readonly (() => Promise<void>)[] = [];
}

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

function planeModel() {
  return Model({
    name: "RedisStorePlane",
    database: Redis("redis://memory"),
    fields: {
      x: Types.float,
      y: Types.float,
      label: z.string(),
    },
    flow: passthrough,
  });
}

function planeEntity(
  entityId: string,
  x: number,
  y: number,
): Record<string, string | number | boolean> {
  return {
    id: entityId,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    isDeleted: false,
    x,
    y,
    label: entityId,
  };
}

function entityOf(
  entityId: string,
  millivolts: number,
  station: string,
  deleted: boolean,
): Record<string, string | number | boolean> {
  return {
    id: entityId,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    isDeleted: deleted,
    millivolts,
    station,
    note: "ok",
  };
}

const pendingOutbox: OutboxEntry = {
  externalId: "ext-1",
  name: "fraud.score",
  entityId: "ent-1",
  model: "RedisStoreSensor",
  runId: "run-b",
  attempt: 1,
  status: OutboxPending,
  input: { amount: 1 },
  stepIndex: 1,
  undoable: true,
  nextAttemptAt: [],
  error: [],
  compensationOf: [],
  dispatchedAt: [],
};

const completedOutbox: OutboxEntry = {
  externalId: "ext-2",
  name: "fraud.score",
  entityId: "ent-1",
  model: "RedisStoreSensor",
  runId: "run-a",
  attempt: 1,
  status: OutboxCompleted,
  input: { amount: 1 },
  output: { score: 9 },
  stepIndex: 0,
  undoable: true,
  nextAttemptAt: [],
  error: [],
  compensationOf: [],
  dispatchedAt: [],
};

const forwardRun: RunStateWrite = {
  runId: "run-b",
  model: "RedisStoreSensor",
  entityId: "ent-1",
  operation: "create",
  body: { millivolts: 1 },
  filterJson: "{}",
  phase: Phase.Forward,
  pivotExternalId: [],
  error: [],
};

const doneRun: RunStateWrite = {
  runId: "run-a",
  model: "RedisStoreSensor",
  entityId: "ent-1",
  operation: "create",
  body: { millivolts: 1 },
  filterJson: "{}",
  phase: Phase.Completed,
  pivotExternalId: [],
  error: [],
};

const forwardRunRow = {
  ...forwardRun,
  updatedAt: ["2020-01-02T00:00:00.000Z"],
};

const doneRunRow = {
  ...doneRun,
  updatedAt: ["2020-01-01T00:00:00.000Z"],
};

describe("redis keys and codec", () => {
  it("builds keys and unique text slots", () => {
    assert.equal(entityKey("sensor", "id-1"), "e:sensor:id-1");
    assert.equal(liveKey("sensor"), "i:sensor");
    assert.equal(uniqueKey("sensor", "station", "dock"), "u:sensor:station:dock");
    assert.deepEqual(uniqueText("dock"), ["dock"]);
    assert.deepEqual(uniqueText(12), ["12"]);
    assert.deepEqual(uniqueText(true), []);
    assert.throws(() => entityKey("", "id-1"), DatabaseError);
    assert.throws(() => liveKey(""), DatabaseError);
    assert.throws(() => uniqueKey("sensor", "", "dock"), DatabaseError);
  });

  it("parses outbox and run payloads and orders them", () => {
    const pending = parseOutbox(JSON.stringify(pendingOutbox));
    const completed = parseOutbox(JSON.stringify(completedOutbox));
    assert.equal(pending.length, 1);
    assert.equal(completed.length, 1);
    assert.equal(parseOutbox("{").length, 0);
    assert.equal(parseOutbox("[]").length, 0);
    assert.equal(parseOutbox(JSON.stringify({ ...pendingOutbox, status: "nope" })).length, 0);
    assert.equal(parseOutbox(JSON.stringify({ ...completedOutbox, output: 1 })).length, 0);
    const forward = parseRun(JSON.stringify(forwardRunRow));
    const finished = parseRun(JSON.stringify(doneRunRow));
    assert.equal(forward.length, 1);
    assert.equal(finished.length, 1);
    assert.equal(parseRun("{").length, 0);
    assert.equal(parseRun(JSON.stringify({ ...forwardRun, phase: "nope" })).length, 0);
    for (const left of pending) {
      for (const right of completed) {
        assert.ok(compareOutboxOrder(left, right) !== 0);
      }
    }
    for (const left of forward) {
      for (const right of finished) {
        assert.ok(compareRunOrder(left, right) !== 0);
        assert.equal(
          compareRunOrder({ ...left, updatedAt: [] }, { ...right, updatedAt: [] }) !== 0,
          true,
        );
      }
    }
    assert.equal(compareText("a", "b"), -1);
    assert.equal(compareText("b", "a"), 1);
    assert.equal(compareText("a", "a"), 0);
    assert.deepEqual(slicePage(["a", "b", "c"], 1, 1), ["b"]);
  });
});

describe("redis store", () => {
  it("writes reads lists outbox and runs on the same query surface", async () => {
    const driver = new MemoryDriver();
    const reported: string[] = [];
    const store = RedisStore.create(driver, [(message) => reported.push(message)]);
    const model = sensorModel();
    const errorBox = { message: "ok" };
    assert.deepEqual(store.lastSqlState(), []);
    assert.equal(await store.applyDdlLockTimeout(5), true);
    assert.equal(await store.ensureAllTables([model], [model], mockPg, errorBox, { control: false }), true);
    const first = entityOf("id-1", 10, "dock-1", false);
    const second = entityOf("id-2", 20, "dock-2", false);
    assert.equal(await store.upsertEntity(model, first), true);
    assert.equal(await store.upsertEntity(model, second), true);
    assert.equal(await store.upsertEntity(model, entityOf("id-3", 10, "dock-9", false)), false);
    const loaded = await store.loadEntity(model, "id-1", []);
    assert.equal(loaded.station, "dock-1");
    await assert.rejects(() => store.loadEntity(model, "missing", ["write"]), NotFoundError);
    const listed = await store.queryEntities(model, emptyFilterInput(), {
      limit: [1],
      offset: [0],
      order: [{ field: "millivolts", direction: "desc" }],
    });
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.millivolts, 20);
    const missed = await store.queryEntities(
      model,
      { station: { eq: "none" } },
      {
        limit: [],
        offset: [],
        order: [{ field: "station", direction: "asc" }],
      },
    );
    assert.equal(missed.length, 0);
    const tombstone = entityOf("id-1", 10, "dock-1", true);
    assert.equal(await store.upsertEntity(model, tombstone), true);
    await assert.rejects(() => store.loadEntity(model, "id-1", []), NotFoundError);
    const live = await store.queryEntities(model, emptyFilterInput());
    assert.equal(live.length, 1);
    assert.equal(await store.removeEntityRow([model], "RedisStoreSensor", "id-2"), true);
    await assert.rejects(() => store.removeEntityRow([model], "Unknown", "id-2"), DatabaseError);
    assert.equal(await store.saveOutboxEntry(pendingOutbox), true);
    assert.equal(await store.saveOutboxEntry(completedOutbox), true);
    const outbox = new Map();
    assert.equal(await store.loadOutbox(outbox, errorBox), true);
    assert.equal(outbox.has("ext-1"), true);
    assert.equal(outbox.has("ext-2"), false);
    const outboxRows = await store.queryOutbox({
      status: ["pending"],
      runId: ["run-b"],
      limit: 10,
      offset: 0,
    });
    assert.equal(outboxRows.length, 1);
    assert.equal(await store.saveRunState(forwardRun), true);
    assert.equal(await store.saveRunState(doneRun), true);
    const loadedRun = await store.loadRunState("run-b");
    assert.equal(loadedRun.length, 1);
    const resumable = await store.loadResumableRuns(10);
    assert.equal(resumable.length, 1);
    const queried = await store.queryRuns({ phase: [Phase.Forward], limit: 10, offset: 0 });
    assert.equal(queried.length, 1);
    const pruned = await store.pruneSettledRuns("2099-01-01T00:00:00.000Z");
    assert.equal(pruned.includes("run-a"), true);
    const session = await store.connectSession();
    assert.equal(await session.begin(), true);
    assert.equal(await session.commit(), true);
    assert.equal(await session.rollback(), true);
    assert.equal(await session.setLockTimeout(5), true);
    assert.equal(await session.beginReadSnapshot(), true);
    session.release();
    await assert.rejects(() => session.setLockTimeout(0), DatabaseError);
    await assert.rejects(() => store.selectRows("SELECT 1", []), DatabaseError);
    await assert.rejects(() => store.applyDdlLockTimeout(0), DatabaseError);
  });

  it("lists live rows with one mGet and reads a single id without scanning", async () => {
    const driver = new MemoryDriver();
    const store = RedisStore.create(driver, []);
    const model = sensorModel();
    const errorBox = { message: "ok" };
    assert.equal(await store.ensureAllTables([model], [model], mockPg, errorBox, { control: false }), true);
    assert.equal(await store.upsertEntity(model, entityOf("id-1", 10, "dock-1", false)), true);
    assert.equal(await store.upsertEntity(model, entityOf("id-2", 20, "dock-2", false)), true);
    driver.getCalls = 0;
    driver.mGetCalls = 0;
    const listed = await store.queryEntities(model, emptyFilterInput());
    assert.equal(listed.length, 2);
    assert.equal(driver.mGetCalls, 1);
    assert.equal(driver.getCalls, 0);
    driver.getCalls = 0;
    driver.mGetCalls = 0;
    const one = await store.queryEntities(model, { id: { eq: "id-2" } });
    assert.equal(one.length, 1);
    assert.equal(one[0]?.station, "dock-2");
    assert.equal(driver.mGetCalls, 0);
    assert.equal(driver.getCalls, 1);
    driver.getCalls = 0;
    driver.mGetCalls = 0;
    const many = await store.queryEntities(model, { id: { in: ["id-1", "id-2"] } });
    assert.equal(many.length, 2);
    assert.equal(driver.mGetCalls, 1);
    assert.equal(driver.getCalls, 0);
  });

  it("lists a 300-pitch plane cell without scanning every live row", async () => {
    const driver = new MemoryDriver();
    const store = RedisStore.create(driver, []);
    const model = planeModel();
    const errorBox = { message: "ok" };
    assert.equal(await store.ensureAllTables([model], [model], mockPg, errorBox, { control: false }), true);
    assert.equal(await store.upsertEntity(model, planeEntity("id-a", 10, 10)), true);
    assert.equal(await store.upsertEntity(model, planeEntity("id-b", 310, 10)), true);
    assert.equal(await store.upsertEntity(model, planeEntity("id-c", 10, 310)), true);
    driver.getCalls = 0;
    driver.mGetCalls = 0;
    const origin = await store.queryEntities(model, {
      x: { gte: 0, lt: 300 },
      y: { gte: 0, lt: 300 },
    });
    assert.equal(origin.length, 1);
    assert.equal(origin[0]?.label, "id-a");
    assert.equal(driver.mGetCalls, 1);
    assert.equal(await store.upsertEntity(model, planeEntity("id-a", 310, 10)), true);
    const empty = await store.queryEntities(model, {
      x: { gte: 0, lt: 300 },
      y: { gte: 0, lt: 300 },
    });
    assert.equal(empty.length, 0);
    const east = await store.queryEntities(model, {
      x: { gte: 300, lt: 600 },
      y: { gte: 0, lt: 300 },
    });
    assert.equal(east.length, 2);
    assert.equal(await store.removeEntityRow([model], "RedisStorePlane", "id-b"), true);
    const after = await store.queryEntities(model, {
      x: { gte: 300, lt: 600 },
      y: { gte: 0, lt: 300 },
    });
    assert.equal(after.length, 1);
    assert.equal(after[0]?.label, "id-a");
  });

  it("reports driver failures and refuses a broken session connect", async () => {
    const driver = new MemoryDriver();
    const reported: string[] = [];
    const store = RedisStore.create(driver, [(message) => reported.push(message)]);
    const model = sensorModel();
    const errorBox = { message: "ok" };
    driver.boom = true;
    assert.equal(await store.ensureAllTables([model], [model], mockPg, errorBox, { control: false }), false);
    assert.equal(await store.upsertEntity(model, entityOf("id-1", 1, "a", false)), false);
    await assert.rejects(() => store.loadEntity(model, "id-1", []), DatabaseError);
    await assert.rejects(() => store.queryEntities(model, emptyFilterInput()), DatabaseError);
    assert.equal(await store.saveOutboxEntry(pendingOutbox), false);
    assert.equal(await store.loadOutbox(new Map(), errorBox), false);
    assert.deepEqual(await store.pruneSettledRuns("2020-01-01T00:00:00.000Z"), []);
    await assert.rejects(() => store.queryRuns({ phase: [], limit: 1, offset: 0 }), DatabaseError);
    await assert.rejects(
      () => store.queryOutbox({ status: [], runId: [], limit: 1, offset: 0 }),
      DatabaseError,
    );
    assert.equal(await store.saveRunState(forwardRun), false);
    assert.deepEqual(await store.loadRunState("run-b"), []);
    assert.deepEqual(await store.loadResumableRuns(1), []);
    assert.equal(await store.removeEntityRow([model], "RedisStoreSensor", "id-1"), false);
    assert.ok(reported.length > 0);
    driver.boom = false;
    driver.failConnect = true;
    await assert.rejects(() => store.connectSession(), DatabaseError);
    assert.throws(
      () => RedisStore.create({ get: "nope" } as unknown as RedisDriver),
      DatabaseError,
    );
  });
});
