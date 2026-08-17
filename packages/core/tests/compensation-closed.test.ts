import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, External, Failed, Model, Running, app } from "../src/index.ts";
import { runCompensationClosed } from "../src/engine/compensation.ts";
import type { OutboxEntry } from "../src/engine/outbox.ts";
import { Phase } from "../src/signal.ts";
import { MockDb } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const releaseBad = External({
  name: "cmp.release_bad",
  input: { token: z.string().min(1) },
  output: { ok: z.boolean() },
  attempts: 1,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const reserveBad = External({
  name: "cmp.reserve_bad",
  input: { sku: z.string() },
  output: { holdId: z.string() },
  attempts: 1,
  backoff: "fixed",
  timeoutMs: 30_000,
  compensate: releaseBad,
});

const releaseGood = External({
  name: "cmp.release_good",
  input: { holdId: z.string() },
  output: { ok: z.boolean() },
  attempts: 1,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const reserveGood = External({
  name: "cmp.reserve_good",
  input: { sku: z.string() },
  output: { holdId: z.string() },
  attempts: 1,
  backoff: "fixed",
  timeoutMs: 30_000,
  compensate: releaseGood,
});

const notify = External({
  name: "cmp.notify",
  input: { to: z.string() },
  output: { sent: z.boolean() },
  attempts: 1,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const parcel = Model({
  name: "CmpParcel",
  fields: { sku: z.string() },
  flow: {
    async create(flow) {
      const held = await flow.external(reserveGood, { sku: flow.body.sku });
      if (held.signal !== Done) {
        return held.signal;
      }
      const later = await flow.external(reserveBad, { sku: flow.body.sku });
      if (later.signal !== Done) {
        return later.signal;
      }
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

function undoNames(db: MockDb): readonly string[] {
  let names: readonly string[] = [];
  for (const row of db.outbox.values()) {
    const compensation = row.compensation_of;
    if (typeof compensation !== "string") {
      continue;
    }
    if (compensation.length < 1) {
      continue;
    }
    names = [...names, String(row.name)];
  }
  return names.toSorted();
}

describe("compensation fail-closed", () => {
  it("does not undo earlier steps after an undo input will not validate", async () => {
    const db = new MockDb();
    const seen: { externalId: string; name: string }[] = [];
    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [parcel],
      externals: [reserveGood, releaseGood, reserveBad, releaseBad] as const,
      onExternalEvent: async (event) => {
        seen.push({ externalId: event.externalId, name: event.name });
      },
    });

    const started = await fookie.create(parcel, { sku: "SKU-1" });
    assert.equal(started.signal, Running);
    if (started.signal !== Running) {
      return;
    }

    for (let round = 0; round < 6; round += 1) {
      for (const event of seen.splice(0)) {
        if (event.name === "cmp.reserve_good" || event.name === "cmp.reserve_bad") {
          await fookie.setExternalResult({
            externalId: event.externalId,
            output: { holdId: `hold-${event.name}` },
          });
        }
      }
      const signal = await fookie.resume(started.runId);
      if (signal !== Running) {
        assert.equal(signal, Failed);
        break;
      }
    }

    const undone = undoNames(db);
    assert.deepEqual(undone, [], "an invalid undo must not skip ahead and void the earlier step");
    const stuck = await fookie.runList({ phase: [Phase.Stuck], limit: 10, offset: 0 });
    assert.equal(stuck.length, 1, "compensation that cannot close must stick the run");
    assert.equal(
      fookie.logs().some((entry) => entry.message === "compensation.input_invalid"),
      true,
    );

    await fookie.stop();
  });

  it("still skips an external that never declared compensate", async () => {
    const db = new MockDb();
    const ping = Model({
      name: "CmpPing",
      fields: { to: z.string() },
      flow: {
        async create(flow) {
          const sent = await flow.external(notify, { to: flow.body.to });
          if (sent.signal !== Done) {
            return sent.signal;
          }
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
    const seen: { externalId: string }[] = [];
    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [ping],
      externals: [notify] as const,
      onExternalEvent: async (event) => {
        seen.push({ externalId: event.externalId });
      },
    });

    const started = await fookie.create(ping, { to: "ops@example.com" });
    assert.equal(started.signal, Running);
    if (started.signal !== Running) {
      return;
    }
    const externalId = seen[0]?.externalId;
    assert.ok(externalId);
    await fookie.setExternalResult({
      externalId,
      output: { sent: true },
    });
    const signal = await fookie.resume(started.runId);
    assert.equal(signal, Failed);
    assert.equal(
      fookie.logs().some((entry) => entry.message === "compensation.skipped"),
      true,
    );
    assert.deepEqual(undoNames(db), []);

    await fookie.stop();
  });

  it("is not closed when a completed forward is unknown", () => {
    const row: OutboxEntry = {
      externalId: "id:ghost",
      name: "cmp.ghost",
      entityId: "e1",
      model: "CmpParcel",
      runId: "run-1",
      input: { sku: "x" },
      attempt: 1,
      stepIndex: 0,
      undoable: false,
      nextAttemptAt: [],
      error: [],
      compensationOf: [],
      dispatchedAt: [],
      status: "completed",
      output: { holdId: "h" },
    };
    assert.equal(runCompensationClosed([row], [reserveGood], "run-1"), false);
  });
});
