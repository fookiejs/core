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
      models: [counter],
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
});
