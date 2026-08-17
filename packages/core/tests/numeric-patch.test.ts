import { z } from "zod";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Failed, Model, ValidationError, app } from "../src/index.ts";
import { applyNumericPatches } from "../src/patch.ts";
import { jsonObjectFromHost, jsonObjectFromRecord } from "../src/values.ts";
import { MockDb, LiveApps } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const pass = {
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

const tally = Model({
  name: "Tally",
  fields: {
    n: z.number(),
    label: z.string(),
  },
  flow: pass,
});

describe("numeric patch and trivial run skip", () => {
  let db: MockDb;
  let apps: LiveApps;
  let port: number;

  beforeEach(() => {
    db = new MockDb();
    apps = new LiveApps();
    port = 31000 + Math.floor(Math.random() * 400);
  });

  afterEach(async () => {
    await apps.shutdown();
  });

  function boot() {
    return apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [tally],
        externals: [],
        onExternalEvent: async () => {},
      }),
    );
  }

  async function heldN(fookie: ReturnType<typeof boot>, id: string): Promise<number> {
    const listed = await fookie.list(tally, { id: { eq: id } });
    assert.equal(listed.signal, Done);
    assert.equal(listed.results.length, 1);
    for (const row of listed.results) {
      const n = row.n;
      if (typeof n !== "number") {
        throw new Error("tally n required");
      }
      return n;
    }
    throw new Error("tally row required");
  }

  it("adds subtracts multiplies and divides without a prior read", async () => {
    const fookie = boot();
    const created = await fookie.create(tally, { n: 10, label: "a" });
    assert.equal(created.signal, Done);
    if (created.signal !== Done) {
      return;
    }

    const added = await fookie.update(tally, { id: { eq: created.id } }, { n: { add: 3 } });
    assert.equal(added.signal, Done);
    assert.equal(await heldN(fookie, created.id), 13);

    const subtracted = await fookie.update(tally, { id: { eq: created.id } }, { n: { sub: 1 } });
    assert.equal(subtracted.signal, Done);
    assert.equal(await heldN(fookie, created.id), 12);

    const multiplied = await fookie.update(tally, { id: { eq: created.id } }, { n: { mul: 2 } });
    assert.equal(multiplied.signal, Done);
    assert.equal(await heldN(fookie, created.id), 24);

    const divided = await fookie.update(tally, { id: { eq: created.id } }, { n: { div: 4 } });
    assert.equal(divided.signal, Done);
    assert.equal(await heldN(fookie, created.id), 6);
  });

  it("fails when the patched field is missing", () => {
    assert.throws(
      () => applyNumericPatches({ label: "b" }, { n: { add: 1 } }),
      ValidationError,
    );
  });

  it("fails when the patched field is not a number", () => {
    assert.throws(
      () => applyNumericPatches({ n: "nope", label: "b" }, { n: { add: 1 } }),
      ValidationError,
    );
  });

  it("fails division by zero and patch on a non-number field", async () => {
    const fookie = boot();
    const created = await fookie.create(tally, { n: 8, label: "c" });
    assert.equal(created.signal, Done);
    if (created.signal !== Done) {
      return;
    }
    const zero = await fookie.update(tally, { id: { eq: created.id } }, { n: { div: 0 } });
    assert.equal(zero.signal, Failed);
    assert.equal(await heldN(fookie, created.id), 8);

    const onLabel = await fookie.update(tally, { id: { eq: created.id } }, { label: { add: 1 } });
    assert.equal(onLabel.signal, Failed);
    assert.equal(await heldN(fookie, created.id), 8);
  });

  it("skips fookie_run for done mutations with no outbox", async () => {
    const fookie = boot();
    const created = await fookie.create(tally, { n: 2, label: "d" });
    assert.equal(created.signal, Done);
    if (created.signal !== Done) {
      return;
    }
    assert.equal(db.runs.size, 0);

    const updated = await fookie.update(tally, { id: { eq: created.id } }, { n: { add: 2 } });
    assert.equal(updated.signal, Done);
    assert.equal(db.runs.size, 0);

    const removed = await fookie.delete(tally, { id: created.id, filter: {} });
    assert.equal(removed.signal, Done);
    assert.equal(db.runs.size, 0);
  });

  it("rejects overflow and copies json records", () => {
    assert.throws(
      () => applyNumericPatches({ n: Number.MAX_VALUE }, { n: { mul: 2 } }),
      ValidationError,
    );
    assert.throws(
      () => applyNumericPatches({ n: Number.POSITIVE_INFINITY }, { n: { add: 1 } }),
      ValidationError,
    );
    const unchanged = applyNumericPatches({ n: 4, label: "keep" }, { label: "x" });
    assert.equal(unchanged.n, 4);
    assert.deepEqual(jsonObjectFromHost({ n: 1 }), [{ n: 1 }]);
    assert.deepEqual(jsonObjectFromHost("{\"n\":1}"), [{ n: 1 }]);
    assert.deepEqual(jsonObjectFromHost("["), []);
    assert.deepEqual(jsonObjectFromHost("[]"), []);
    assert.deepEqual(jsonObjectFromHost(1), []);
    assert.deepEqual(jsonObjectFromRecord({ n: { add: 2 } }), { n: { add: 2 } });
    assert.throws(() => jsonObjectFromRecord(1), ValidationError);
  });
});
