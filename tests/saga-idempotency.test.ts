import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, External, Failed, Model, Running, app } from "../src/index.ts";
import { MockDb } from "./mock-db.ts";

const score = External({
  name: "idem.score",
  input: { amount: z.number().finite().nonnegative() },
  output: { score: z.number().int() },
  attempts: 3,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const notify = External({
  name: "idem.notify",
  input: { to: z.string().email() },
  output: { sent: z.boolean() },
  attempts: 3,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const child = Model({
  name: "IdemChild",
  fields: { message: z.string() },
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

const parentBox: { nestedCalls: number } = { nestedCalls: 0 };

const parent = Model({
  name: "IdemParent",
  fields: { amount: z.number().finite().nonnegative(), score: z.number().int() },
  flow: {
    async create(flow) {
      const scored = await flow.external(score, { amount: flow.body.amount });
      if (scored.signal === Running) {
        return Running;
      }
      if (scored.signal === Failed) {
        return Failed;
      }
      parentBox.nestedCalls += 1;
      const logged = await flow.create(child, { message: "created" });
      if (logged.signal === Running) {
        return Running;
      }
      if (logged.signal === Failed) {
        return Failed;
      }
      const sent = await flow.external(notify, { to: "ops@example.com" });
      if (sent.signal === Running) {
        return Running;
      }
      if (sent.signal === Failed) {
        return Failed;
      }
      flow.body.score = scored.output.score;
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

type SeenEvent = { externalId: string; name: string };

describe("saga idempotency across resumes", () => {
  it("runs a nested create exactly once even though the flow body replays", async () => {
    const db = new MockDb();
    const seen: SeenEvent[] = [];
    parentBox.nestedCalls = 0;

    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [child, parent],
      externals: [score, notify] as const,
      onExternalEvent: async (event) => {
        seen.push({ externalId: event.externalId, name: event.name });
      },
      pool: [db],
    });

    const started = await fookie.create(parent, { amount: 100, score: 0 });
    assert.equal(started.signal, Running);
    if (started.signal !== Running) {
      return;
    }

    let signal: string = Running;
    for (let round = 0; round < 5; round += 1) {
      for (const event of seen.splice(0)) {
        if (event.name === "idem.score") {
          await fookie.setExternalResult({ externalId: event.externalId, output: { score: 42 } });
        } else {
          await fookie.setExternalResult({ externalId: event.externalId, output: { sent: true } });
        }
      }
      signal = await fookie.resume(started.runId);
      if (signal !== Running) {
        break;
      }
    }

    assert.equal(signal, Done, "flow must reach Done after both externals resolve");

    const childRows = db.rows.get("idem_child");
    assert.ok(childRows, "child table must exist");
    assert.equal(
      childRows.size,
      1,
      `nested create must persist exactly one row, found ${childRows.size} — the flow body replayed ${parentBox.nestedCalls} times and each replay allocated a fresh entity id`,
    );

    await fookie.stop();
  });

  it("ignores a duplicate setExternalResult for the same externalId", async () => {
    const db = new MockDb();
    const seen: SeenEvent[] = [];
    parentBox.nestedCalls = 0;

    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [child, parent],
      externals: [score, notify] as const,
      onExternalEvent: async (event) => {
        seen.push({ externalId: event.externalId, name: event.name });
      },
      pool: [db],
    });

    const started = await fookie.create(parent, { amount: 100, score: 0 });
    assert.equal(started.signal, Running);
    if (started.signal !== Running) {
      return;
    }

    const first = seen[0];
    assert.ok(first, "the score external must have been dispatched");

    await Promise.all([
      fookie.setExternalResult({ externalId: first.externalId, output: { score: 42 } }),
      fookie.setExternalResult({ externalId: first.externalId, output: { score: 7 } }),
    ]);

    for (let round = 0; round < 5; round += 1) {
      for (const event of seen.splice(0)) {
        if (event.name === "idem.score") {
          await fookie.setExternalResult({ externalId: event.externalId, output: { score: 42 } });
        } else {
          await fookie.setExternalResult({ externalId: event.externalId, output: { sent: true } });
        }
      }
      const signal = await fookie.resume(started.runId);
      if (signal !== Running) {
        break;
      }
    }

    const childRows = db.rows.get("idem_child");
    assert.ok(childRows, "child table must exist");
    assert.equal(childRows.size, 1, "duplicate delivery must not duplicate nested writes");

    const parentRows = db.rows.get("idem_parent");
    assert.ok(parentRows, "parent table must exist");
    assert.equal(parentRows.size, 1, "duplicate delivery must not duplicate the parent row");

    await fookie.stop();
  });
});
