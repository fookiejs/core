import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, External, Failed, Model, Running, app } from "../src/index.ts";
import { MockDb } from "./mock-db.ts";

const reserve = External({
  name: "fanout.reserve",
  input: { part: z.string(), quantity: z.number().int() },
  output: { stackId: z.string() },
  attempts: 3,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const parts: { list: readonly { part: string; quantity: number }[] } = { list: [] };
const dispatches: { count: number } = { count: 0 };

const build = Model({
  name: "FanoutBuild",
  fields: { title: z.string(), reserved: z.number().int() },
  flow: {
    async create(flow) {
      let held = 0;
      for (const line of parts.list) {
        const got = await flow.external(reserve, { part: line.part, quantity: line.quantity });
        if (got.signal === Running) {
          return Running;
        }
        if (got.signal === Failed) {
          return Failed;
        }
        held = held + 1;
      }
      flow.body.reserved = held;
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

describe("a recipe with a data-driven number of inputs", () => {
  it("dispatches each input exactly once however many times the body replays", async () => {
    parts.list = [
      { part: "steel", quantity: 4 },
      { part: "circuit", quantity: 6 },
      { part: "machine-part", quantity: 2 },
      { part: "computer", quantity: 1 },
    ];
    dispatches.count = 0;
    const db = new MockDb();
    const seen: { externalId: string }[] = [];
    const everSeen = new Set<string>();

    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [build],
      externals: [reserve] as const,
      onExternalEvent: async (event) => {
        dispatches.count = dispatches.count + 1;
        everSeen.add(event.externalId);
        seen.push({ externalId: event.externalId });
      },
      pool: [db],
    });

    const started = await fookie.create(build, { title: "ion-drive", reserved: 0 });
    assert.equal(started.signal, Running, "four inputs must suspend the flow");
    if (started.signal !== Running) {
      return;
    }

    let signal: string = Running;
    for (let round = 0; round < 12; round += 1) {
      for (const event of seen.splice(0)) {
        await fookie.setExternalResult({
          externalId: event.externalId,
          output: { stackId: `stack-${event.externalId.slice(-8)}` },
        });
      }
      signal = await fookie.resume(started.runId);
      if (signal !== Running) {
        break;
      }
    }

    assert.equal(signal, Done, "every reservation resolves, so the build completes");
    assert.equal(
      everSeen.size,
      parts.list.length,
      `each recipe input must own one external id, saw ${everSeen.size} distinct for ${parts.list.length} inputs`,
    );
    assert.equal(
      dispatches.count,
      parts.list.length,
      `a replayed body must not re-dispatch a settled step, dispatched ${dispatches.count} times`,
    );

    await fookie.stop();
  });
});

describe("content edited while a job is in flight", () => {
  it("is caught rather than silently reserving the wrong parts", async () => {
    parts.list = [
      { part: "steel", quantity: 4 },
      { part: "circuit", quantity: 6 },
    ];
    const db = new MockDb();
    const seen: { externalId: string }[] = [];

    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [build],
      externals: [reserve] as const,
      onExternalEvent: async (event) => {
        seen.push({ externalId: event.externalId });
      },
      pool: [db],
    });

    const started = await fookie.create(build, { title: "reactor", reserved: 0 });
    if (started.signal !== Running) {
      assert.fail("two inputs must suspend the flow");
      return;
    }

    for (const event of seen.splice(0)) {
      await fookie.setExternalResult({ externalId: event.externalId, output: { stackId: "s1" } });
    }

    parts.list = [
      { part: "titanium", quantity: 9 },
      { part: "circuit", quantity: 6 },
    ];

    await fookie.resume(started.runId);

    const page = fookie.observability(0);
    const flagged = page.logs.filter((entry) => entry.message === "saga.nondeterministic_replay");
    assert.ok(
      flagged.length > 0,
      "a body that replays a different first step must be reported, not quietly obeyed",
    );

    await fookie.stop();
  });
});
