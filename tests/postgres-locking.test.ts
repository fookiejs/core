import { z } from "zod";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { Done, Model, app } from "../src/index.ts";

const databaseUrl = process.env.FOOKIE_TEST_DATABASE ?? "";

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const counter = Model({
  name: "LockCounter",
  fields: { alpha: z.number().int(), beta: z.number().int() },
  flow: {
    async create() {
      return Done;
    },
    async list() {
      return Done;
    },
    async update() {
      await pause(200);
      return Done;
    },
    async delete() {
      return Done;
    },
  },
});

const crossing = Model({
  name: "LockCrossing",
  fields: { alpha: z.number().int() },
  flow: {
    async create() {
      return Done;
    },
    async list() {
      return Done;
    },
    async update(flow) {
      await pause(300);
      await flow.pg.query("UPDATE public.lock_crossing SET alpha = alpha + 1 WHERE id <> $1", [
        flow.id,
      ]);
      return Done;
    },
    async delete() {
      return Done;
    },
  },
});

describe("postgres row locking", { skip: databaseUrl.length === 0 }, () => {
  let pool: pg.Pool;

  before(() => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 8 });
  });

  after(async () => {
    await pool.end();
  });

  function boot() {
    return app({
      listen: "0",
      database: databaseUrl,
      models: [counter, crossing],
      externals: [] as const,
      onExternalEvent: async () => {},
      pool: [
        {
          query: (sql: string, params?: unknown[]) => pool.query(sql, params),
          connect: () => pool.connect(),
          end: [],
        },
      ],
    });
  }

  it("does not lose a concurrent update to a different field", async () => {
    const writer = boot();
    const created = await writer.create(counter, { alpha: 0, beta: 0 });
    assert.equal(created.signal, "done");
    if (created.signal !== "done") {
      throw new Error("counter create must succeed");
    }

    const second = boot();
    const [alphaDone, betaDone] = await Promise.all([
      writer.update(counter, { id: created.id, body: { alpha: 1 }, filter: {} }),
      second.update(counter, { id: created.id, body: { beta: 1 }, filter: {} }),
    ]);
    assert.equal(alphaDone?.signal, "done");
    assert.equal(betaDone?.signal, "done");

    const row = await pool.query("SELECT alpha, beta FROM public.lock_counter WHERE id = $1", [
      created.id,
    ]);
    assert.equal(row.rowCount, 1);
    for (const stored of row.rows) {
      assert.equal(Number(stored.alpha), 1, "the alpha write survived");
      assert.equal(Number(stored.beta), 1, "the beta write survived");
    }

    await writer.stop();
    await second.stop();
  });

  it("breaks a deadlock instead of hanging on it", async () => {
    const left = boot();
    const right = boot();
    await left.list(crossing, {});
    await pool.query("DELETE FROM public.lock_crossing");

    const first = await left.create(crossing, { alpha: 0 });
    const second = await left.create(crossing, { alpha: 0 });
    assert.equal(first.signal, "done");
    assert.equal(second.signal, "done");
    if (first.signal !== "done" || second.signal !== "done") {
      throw new Error("crossing rows must exist");
    }

    await right.list(crossing, {});

    const startedAt = Date.now();
    const settled = await Promise.all([
      left.update(crossing, { id: first.id, body: { alpha: 1 }, filter: {} }),
      right.update(crossing, { id: second.id, body: { alpha: 1 }, filter: {} }),
    ]);
    const elapsed = Date.now() - startedAt;

    assert.ok(
      elapsed < 20_000,
      `both writers must settle rather than hang, took ${String(elapsed)}ms`,
    );
    const done = settled.filter((outcome) => outcome?.signal === "done");
    assert.ok(done.length >= 1, "one writer must win the deadlock outright");
    assert.equal(done.length, 2, "the victim must retry and then succeed");

    const rows = await pool.query("SELECT id, alpha FROM public.lock_crossing ORDER BY id");
    assert.equal(rows.rowCount, 2);

    await left.stop();
    await right.stop();
  });

  it("keeps one snapshot across every read in the scope", async () => {
    const reader = boot();
    const created = await reader.create(counter, { alpha: 7, beta: 7 });
    assert.equal(created.signal, "done");
    if (created.signal !== "done") {
      throw new Error("counter create must succeed");
    }

    const seen = await reader.withReadSnapshot(async (scope) => {
      const before = await scope.list(counter, { id: { eq: created.id } });

      const outside = new pg.Pool({ connectionString: databaseUrl });
      await outside.query("UPDATE public.lock_counter SET alpha = 99 WHERE id = $1", [created.id]);
      await outside.end();

      const after = await scope.list(counter, { id: { eq: created.id } });
      return { before: before.results, after: after.results };
    });

    for (const row of seen.before) {
      assert.equal(row.alpha, 7);
    }
    for (const row of seen.after) {
      assert.equal(row.alpha, 7, "a write committed mid-query must stay invisible");
    }

    const settled = await pool.query("SELECT alpha FROM public.lock_counter WHERE id = $1", [
      created.id,
    ]);
    for (const row of settled.rows) {
      assert.equal(Number(row.alpha), 99, "the outside write really did commit");
    }

    await reader.stop();
  });
});
