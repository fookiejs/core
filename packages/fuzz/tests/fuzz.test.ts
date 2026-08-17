import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Rng, seedFrom } from "../src/random.ts";
import { brokenBody, isGeneratable, validBody } from "../src/generate.ts";
import { describeStep, planFor, replayOf, shrink } from "../src/plan.ts";
import { checkWorld } from "../src/invariants.ts";
import type { WorldState } from "../src/invariants.ts";
import type { ModelSummary, OutboxEntry, RunStateRow } from "@fookiejs/core";

const order: ModelSummary = {
  name: "Order",
  table: "order",
  fields: [
    {
      key: "id",
      column: "id",
      pgType: "UUID",
      relation: [],
      unique: false,
      index: false,
      system: true,
    },
    {
      key: "email",
      column: "email",
      pgType: "TEXT",
      relation: [],
      unique: true,
      index: false,
      system: false,
    },
    {
      key: "amount",
      column: "amount",
      pgType: "NUMERIC",
      relation: [],
      unique: false,
      index: false,
      system: false,
    },
    {
      key: "count",
      column: "count",
      pgType: "INTEGER",
      relation: [],
      unique: false,
      index: false,
      system: false,
    },
    {
      key: "paid",
      column: "paid",
      pgType: "BOOLEAN",
      relation: [],
      unique: false,
      index: false,
      system: false,
    },
    {
      key: "buyer",
      column: "buyer",
      pgType: "UUID",
      relation: ["Customer"],
      unique: false,
      index: true,
      system: false,
    },
  ],
};

const models: readonly ModelSummary[] = [order];

describe("seeded randomness", () => {
  it("replays exactly from the same seed", () => {
    const left = Rng.create(1234);
    const right = Rng.create(1234);
    for (let at = 0; at < 50; at = at + 1) {
      assert.equal(left.next(), right.next(), `draw ${String(at)} must match`);
    }
  });

  it("diverges on a different seed", () => {
    const left = Rng.create(1);
    const right = Rng.create(2);
    let same = 0;
    for (let at = 0; at < 50; at = at + 1) {
      if (left.next() === right.next()) {
        same = same + 1;
      }
    }
    assert.ok(same < 5, "two seeds must not walk the same path");
  });

  it("stays inside every bound it is given", () => {
    const rng = Rng.create(seedFrom("bounds"));
    for (let at = 0; at < 300; at = at + 1) {
      const drawn = rng.below(7);
      assert.ok(drawn >= 0 && drawn < 7, `below(7) produced ${String(drawn)}`);
      const ranged = rng.between(-3, 3);
      assert.ok(ranged >= -3 && ranged <= 3, `between produced ${String(ranged)}`);
    }
  });

  it("derives a stable seed from a name", () => {
    assert.equal(seedFrom("nightly"), seedFrom("nightly"));
    assert.notEqual(seedFrom("nightly"), seedFrom("hourly"));
  });

  it("refuses a seed it cannot replay", () => {
    assert.throws(() => Rng.create(-1), /negative/);
    assert.throws(() => Rng.create(1.5), /integer/);
  });
});

describe("bodies from the model", () => {
  it("fills every writable field and leaves the system ones alone", () => {
    const rng = Rng.create(7);
    const body = validBody(order, rng);
    assert.equal("id" in body, false, "the engine owns the id");
    assert.equal("buyer" in body, false, "a relation needs a real parent, not a made up one");
    for (const field of order.fields) {
      if (isGeneratable(field) === false) {
        continue;
      }
      assert.ok(field.key in body, `${field.key} must be filled`);
    }
  });

  it("respects the column type", () => {
    const rng = Rng.create(11);
    for (let at = 0; at < 40; at = at + 1) {
      const body = validBody(order, rng);
      assert.equal(typeof body.paid, "boolean");
      assert.equal(typeof body.amount, "number");
      assert.equal(typeof body.email, "string");
      assert.equal(Number.isInteger(body.count), true, "an INTEGER column gets a whole number");
    }
  });

  it("keeps a unique column unique across draws", () => {
    const rng = Rng.create(13);
    const seen = new Set<string>();
    for (let at = 0; at < 60; at = at + 1) {
      seen.add(String(validBody(order, rng).email));
    }
    assert.equal(seen.size, 60, "a unique column must not collide with itself");
  });

  it("fills a relation once the parent is known", () => {
    const rng = Rng.create(17);
    const body = validBody(order, rng, { Customer: "00000000-0000-7000-8000-000000000001" });
    assert.equal(body.buyer, "00000000-0000-7000-8000-000000000001");
  });

  it("breaks a body in a way it can name", () => {
    const rng = Rng.create(19);
    let kinds = new Set<string>();
    for (let at = 0; at < 60; at = at + 1) {
      for (const broken of brokenBody(order, rng)) {
        kinds.add(broken.breakage);
      }
    }
    assert.ok(kinds.size >= 4, `expected several breakages, saw ${String(kinds.size)}`);
  });
});

describe("plans", () => {
  it("is reproducible from its seed", () => {
    const left = planFor(models, 42, 30);
    const right = planFor(models, 42, 30);
    assert.deepEqual(left, right, "the same seed must make the same plan");
  });

  it("always opens with something that can exist", () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const plan = planFor(models, seed, 10);
      assert.equal(plan.steps[0]?.kind, "create", "a plan cannot update what was never made");
    }
  });

  it("carries the instructions to replay itself", () => {
    const plan = planFor(models, 8, 12);
    assert.match(replayOf(plan), /planFor\(models, 8, 12\)/);
  });

  it("shrinks to a prefix so a failure can be narrowed", () => {
    const plan = planFor(models, 5, 20);
    const smaller = shrink(plan, 3);
    assert.equal(smaller.steps.length, 3);
    assert.deepEqual(smaller.steps, plan.steps.slice(0, 3), "shrinking keeps the same history");
    assert.equal(shrink(plan, 999).steps.length, 20, "asking for more than exists changes nothing");
  });

  it("describes a step well enough to read in a report", () => {
    const plan = planFor(models, 21, 6);
    for (const step of plan.steps) {
      assert.match(describeStep(step), /^(create|create-invalid|list|update|delete) Order/);
    }
  });
});

function worldWith(runs: readonly RunStateRow[], outbox: readonly OutboxEntry[]): WorldState {
  return { models, runs, outbox };
}

describe("invariants", () => {
  it("passes a world where nothing is wrong", () => {
    const runs = [{ runId: "r1", phase: "completed", model: "Order" }] as unknown as RunStateRow[];
    const outbox = [
      { runId: "r1", name: "pay", status: "completed", attempt: 1, error: [], compensationOf: [] },
    ] as unknown as OutboxEntry[];
    assert.deepEqual(checkWorld(worldWith(runs, outbox)), []);
  });

  it("catches a run that completed and was compensated anyway", () => {
    const runs = [{ runId: "r1", phase: "completed", model: "Order" }] as unknown as RunStateRow[];
    const outbox = [
      {
        runId: "r1",
        name: "refund",
        status: "completed",
        attempt: 1,
        error: [],
        compensationOf: ["fwd"],
      },
    ] as unknown as OutboxEntry[];
    const findings = checkWorld(worldWith(runs, outbox));
    assert.equal(findings.length, 1);
    for (const finding of findings) {
      assert.match(finding.invariant, /completed runs are never compensated/);
      assert.deepEqual(finding.runId, ["r1"]);
    }
  });

  it("catches a dead letter that never says why", () => {
    const runs = [{ runId: "r1", phase: "stuck", model: "Order" }] as unknown as RunStateRow[];
    const outbox = [
      {
        runId: "r1",
        name: "pay",
        status: "dead_letter",
        attempt: 3,
        error: [],
        compensationOf: [],
      },
    ] as unknown as OutboxEntry[];
    const findings = checkWorld(worldWith(runs, outbox));
    assert.equal(findings.length, 1);
    for (const finding of findings) {
      assert.match(finding.invariant, /dead letter states its reason/);
    }
  });

  it("catches an unsettled external whose run has vanished", () => {
    const runs = [{ runId: "r1", phase: "forward", model: "Order" }] as unknown as RunStateRow[];
    const outbox = [
      { runId: "ghost", name: "pay", status: "pending", attempt: 1, error: [], compensationOf: [] },
    ] as unknown as OutboxEntry[];
    const findings = checkWorld(worldWith(runs, outbox));
    assert.equal(findings.length, 1);
    for (const finding of findings) {
      assert.match(finding.invariant, /belongs to a run/);
    }
  });

  it("catches an external that blew past any sane attempt budget", () => {
    const runs = [{ runId: "r1", phase: "forward", model: "Order" }] as unknown as RunStateRow[];
    const outbox = [
      { runId: "r1", name: "pay", status: "pending", attempt: 99, error: [], compensationOf: [] },
    ] as unknown as OutboxEntry[];
    const findings = checkWorld(worldWith(runs, outbox));
    assert.equal(findings.length, 1);
    for (const finding of findings) {
      assert.match(finding.invariant, /attempt budget/);
    }
  });
});
