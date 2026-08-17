import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, External, Failed, Model, Running, app } from "../src/index.ts";
import { MockDb } from "./mock-db.ts";
import { cacheEntity } from "../src/engine/runtime.ts";
import { entityCacheLimit } from "../src/observability.ts";
import { entityRecordFromPlain } from "../src/values.ts";
import type { EntityRecord } from "../src/values.ts";
import { Postgres } from "./engines.ts";

const first = External({
  name: "replay.first",
  input: { amount: z.number().finite().nonnegative() },
  output: { ok: z.boolean() },
  attempts: 3,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const second = External({
  name: "replay.second",
  input: { amount: z.number().finite().nonnegative() },
  output: { ok: z.boolean() },
  attempts: 3,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const bodyRuns = { count: 0 };

const ledger = Model({
  name: "ReplayLedger",
  fields: { amount: z.number().finite().nonnegative() },
  flow: {
    async create(flow) {
      bodyRuns.count = bodyRuns.count + 1;
      flow.metric.increment("ledger.opened");
      flow.log("ledger opened", { amount: flow.body.amount });

      const one = await flow.external(first, { amount: flow.body.amount });
      if (one.signal === Running) {
        return Running;
      }
      if (one.signal === Failed) {
        return Failed;
      }

      flow.metric.increment("ledger.first.settled");

      const two = await flow.external(second, { amount: flow.body.amount });
      if (two.signal === Running) {
        return Running;
      }
      if (two.signal === Failed) {
        return Failed;
      }

      flow.metric.increment("ledger.closed");
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

function countOf(entries: readonly { name: string }[], name: string): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.name === name) {
      total = total + 1;
    }
  }
  return total;
}

function messageCountOf(entries: readonly { message: string }[], message: string): number {
  let total = 0;
  for (const entry of entries) {
    if (entry.message === message) {
      total = total + 1;
    }
  }
  return total;
}

describe("a replayed flow body does not re-emit what it already emitted", () => {
  it("counts a metric once per run, not once per resume", async () => {
    const db = new MockDb();
    const seen: SeenEvent[] = [];
    bodyRuns.count = 0;

    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [ledger],
      externals: [first, second] as const,
      onExternalEvent: async (event) => {
        seen.push({ externalId: event.externalId, name: event.name });
      },
    });

    const started = await fookie.create(ledger, { amount: 100 });
    assert.equal(started.signal, Running, "two externals must suspend the flow");
    if (started.signal !== Running) {
      return;
    }

    let signal: string = Running;
    for (let round = 0; round < 5; round += 1) {
      for (const event of seen.splice(0)) {
        await fookie.setExternalResult({ externalId: event.externalId, output: { ok: true } });
      }
      signal = await fookie.resume(started.runId);
      if (signal !== Running) {
        break;
      }
    }
    assert.equal(signal, Done, "flow must reach Done once both externals resolve");
    assert.ok(bodyRuns.count > 1, "the test is meaningless unless the body actually replayed");

    const page = fookie.observability(0);

    assert.equal(
      countOf(page.metrics, "replayledger.ledger.opened"),
      1,
      `a counter at the top of the body must be counted once, not once per replay — the body ran ${bodyRuns.count} times`,
    );
    assert.equal(
      countOf(page.metrics, "replayledger.ledger.first.settled"),
      1,
      "a counter after the first external must survive exactly one emission",
    );
    assert.equal(
      countOf(page.metrics, "replayledger.ledger.closed"),
      1,
      "the final counter runs once",
    );
    assert.equal(
      messageCountOf(page.logs, "ledger opened"),
      1,
      "a log line before the suspension point must not repeat on every resume",
    );

    await fookie.stop();
  });

  it("separates starting a run from resuming one", async () => {
    const db = new MockDb();
    const seen: SeenEvent[] = [];
    bodyRuns.count = 0;

    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [ledger],
      externals: [first, second] as const,
      onExternalEvent: async (event) => {
        seen.push({ externalId: event.externalId, name: event.name });
      },
    });

    const started = await fookie.create(ledger, { amount: 50 });
    if (started.signal !== Running) {
      assert.fail("two externals must suspend the flow");
      return;
    }

    let resumes = 0;
    let signal: string = Running;
    for (let round = 0; round < 5; round += 1) {
      for (const event of seen.splice(0)) {
        await fookie.setExternalResult({ externalId: event.externalId, output: { ok: true } });
      }
      resumes = resumes + 1;
      signal = await fookie.resume(started.runId);
      if (signal !== Running) {
        break;
      }
    }
    assert.equal(signal, Done);

    const metrics = fookie.observability(0).metrics;
    assert.equal(
      countOf(metrics, "replayledger.operation.started"),
      1,
      "one create is one start, however many times it suspends",
    );
    assert.ok(resumes > 0, "the driver must have resumed at least once");
    assert.equal(
      countOf(metrics, "replayledger.operation.resumed"),
      bodyRuns.count - 1,
      "every replay of the body is reported as a resume rather than a second start",
    );
    assert.equal(
      countOf(metrics, "replayledger.operation.completed"),
      1,
      "and the run completes exactly once",
    );

    await fookie.stop();
  });
});

describe("a settlement this process never dispatched", () => {
  it("says so instead of dropping it silently", async () => {
    const db = new MockDb();

    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [ledger],
      externals: [first, second] as const,
      onExternalEvent: async () => undefined,
    });
    await fookie.ready();

    const accepted = await fookie.setExternalResult({
      externalId: "v2:not-a-run:not-an-entity:0:replay.first",
      output: { ok: true },
    });
    assert.equal(accepted, false, "an unknown external id cannot be accepted");

    const page = fookie.observability(0);
    assert.equal(
      countOf(page.metrics, "dispatcher.external.result_unknown"),
      1,
      "a dropped settlement must be counted, not swallowed",
    );
    assert.ok(
      messageCountOf(page.logs, "external.result_unknown") > 0,
      "and it must say why, because the cause is usually that another node dispatched it",
    );

    await fookie.stop();
  });
});

describe("the entity cache is bounded", () => {
  it("evicts rather than growing for as long as the process lives", () => {
    const entities = new Map<string, EntityRecord>();
    const rows = entityCacheLimit + 250;
    for (let at = 0; at < rows; at += 1) {
      const id = `entity-${at}`;
      cacheEntity(entities, id, entityRecordFromPlain({ id }));
    }
    assert.ok(
      entities.size <= entityCacheLimit,
      `a read-through cache with no bound is a leak: held ${entities.size} of ${rows}`,
    );
    assert.equal(
      entities.has(`entity-${rows - 1}`),
      true,
      "the entry just written must survive its own eviction pass",
    );
    assert.equal(entities.has("entity-0"), false, "the oldest entry is the one that goes");
  });
});
