import { z } from "zod";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { Done, Model, app } from "@fookiejs/core";
import type { ModelSummary } from "@fookiejs/core";
import { Postgres } from "../../postgresql/src/index.ts";
import { fuzz, summarise } from "../src/run.ts";
import type { CallOutcome, PlannedStep } from "../src/index.ts";
import { seedFrom } from "../src/random.ts";
import { ensureTestPostgres } from "../../core/tests/postgres-env.ts";

const databaseUrl = await ensureTestPostgres();

const account = Model({
  name: "FuzzAccount",
  fields: {
    holder: z.string().meta({ index: true }),
    balance: z.number().int(),
    active: z.boolean(),
  },
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

describe("fuzzing a real app", () => {
  let pool: pg.Pool;

  before(() => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 6 });
  });

  after(async () => {
    await pool.end();
  });

  function boot() {
    return app({
      listen: "0",
      database: Postgres(databaseUrl, [
        {
          query: (sql: string, params?: unknown[]) => pool.query(sql, params),
          connect: () => pool.connect(),
          end: [],
        },
      ]),
      models: [account],
      externals: [] as const,
      onExternalEvent: async () => {},
    });
  }

  it("throws a generated sequence at the app and finds no broken invariant", async () => {
    const fookie = boot();
    await fookie.ready();
    await pool.query("DELETE FROM public.fuzz_account");

    const madeIds: string[] = [];
    const runStep = async (step: PlannedStep, model: ModelSummary): Promise<CallOutcome> => {
      const described = `${step.kind} ${model.name}`;
      if (step.kind === "create" || step.kind === "create-invalid") {
        const outcome = await fookie.create(account, step.body as never);
        if (outcome.signal === "done") {
          madeIds.push(outcome.id);
        }
        return { step: described, signal: outcome.signal, threw: [] };
      }
      if (step.kind === "list") {
        const outcome = await fookie.list(account, {});
        return { step: described, signal: outcome.signal, threw: [] };
      }
      if (madeIds.length < 1) {
        return { step: described, signal: "skipped", threw: [] };
      }
      const id = madeIds[step.targetIndex % madeIds.length] ?? madeIds[0] ?? "";
      if (step.kind === "update") {
        const outcome = await fookie.update(account, { id: { eq: id } }, step.body as never);
        return { step: described, signal: outcome.signal, threw: [] };
      }
      const outcome = await fookie.delete(account, { id, filter: {} });
      return { step: described, signal: outcome.signal, threw: [] };
    };

    const report = await fuzz(fookie, seedFrom("first run"), 40, runStep);

    assert.equal(report.outcomes.length, 40, "every planned step must have been attempted");
    assert.deepEqual(report.findings, [], `invariants broke: ${summarise(report)}`);

    let done = 0;
    let refused = 0;
    for (const outcome of report.outcomes) {
      if (outcome.signal === "done") {
        done = done + 1;
      }
      if (outcome.signal === "failed") {
        refused = refused + 1;
      }
      assert.equal(outcome.threw.length, 0, `a step threw: ${String(outcome.threw[0])}`);
    }
    assert.ok(done > 0, "a valid body has to be accepted at least once");
    assert.ok(refused > 0, "an invalid body has to be refused at least once");

    await fookie.stop();
  });

  it("refuses a bad body without writing anything", async () => {
    const fookie = boot();
    await fookie.ready();
    await pool.query("DELETE FROM public.fuzz_account");

    const before = await pool.query("SELECT count(*) AS n FROM public.fuzz_account");
    const rejected = await fookie.create(account, {
      holder: 12345,
      balance: "not a number",
      active: "yes",
    } as never);
    assert.equal(rejected.signal, "failed", "a body of wrong types must be refused");

    const after = await pool.query("SELECT count(*) AS n FROM public.fuzz_account");
    assert.equal(
      String(after.rows[0]?.n),
      String(before.rows[0]?.n),
      "a refused request must leave the table exactly as it found it",
    );

    await fookie.stop();
  });

  it("replays the same sequence from the same seed", async () => {
    const fookie = boot();
    await fookie.ready();

    const seen: string[] = [];
    const record = async (step: PlannedStep): Promise<CallOutcome> => {
      seen.push(`${step.kind}:${String(Object.keys(step.body).length)}`);
      return { step: step.kind, signal: "skipped", threw: [] };
    };

    const first = await fuzz(fookie, 4242, 25, record);
    const firstSeen = seen.slice();
    seen.length = 0;
    const second = await fuzz(fookie, 4242, 25, record);

    assert.deepEqual(seen, firstSeen, "the same seed must drive the same calls");
    assert.equal(first.replay, second.replay);

    await fookie.stop();
  });
});
