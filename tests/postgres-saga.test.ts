import { z } from "zod";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { Done, External, FailureClass, Model, Types, app } from "../src/index.ts";

const databaseUrl = process.env.FOOKIE_TEST_DATABASE ?? "";

const refund = External({
  name: "pgsaga.refund",
  input: { amount: z.number().finite().nonnegative(), reference: z.string() },
  output: { released: z.boolean() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const charge = External({
  name: "pgsaga.charge",
  input: { amount: z.number().finite().nonnegative() },
  output: { reference: z.string() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
  compensate: refund,
});

const settle = External({
  name: "pgsaga.settle",
  input: { reference: z.string() },
  output: { settled: z.boolean() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const owner = Model({
  name: "PgSagaOwner",
  fields: { email: z.string().email().meta({ unique: true }) },
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

const order = Model({
  name: "PgSagaOrder",
  fields: {
    amount: z.number().finite().nonnegative(),
    sku: z.string().meta({ index: true }),
    buyer: Types.relation({ name: "PgSagaOwner" }),
  },
  flow: {
    async create(flow) {
      const paid = await flow.external(charge, { amount: flow.body.amount });
      if (paid.signal !== "done") {
        return paid.signal;
      }
      const done = await flow.external(settle, { reference: paid.output.reference });
      return done.signal;
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

describe("postgres saga schema", { skip: databaseUrl.length === 0 }, () => {
  let pool: pg.Pool;

  before(() => {
    pool = new pg.Pool({ connectionString: databaseUrl });
  });

  after(async () => {
    await pool.end();
  });

  function injectable() {
    return {
      query: (sql: string, params?: unknown[]) => pool.query(sql, params),
      connect: () => pool.connect(),
      end: [],
    };
  }

  function boot() {
    return app({
      listen: "0",
      database: databaseUrl,
      models: [owner, order],
      externals: [charge, settle, refund] as const,
      onExternalEvent: async () => {},
      pool: [injectable()],
    });
  }

  async function indexNames(table: string): Promise<readonly string[]> {
    const found = await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = $1", [
      table,
    ]);
    return found.rows.map((row) => String(row.indexname));
  }

  it("creates the run and outbox tables with every saga column", async () => {
    const fookie = boot();
    await fookie.list(owner, {});

    const runCols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'fookie_run'",
    );
    const runNames = runCols.rows.map((row) => String(row.column_name));
    for (const expected of ["run_id", "model", "entity_id", "operation", "body", "saga_phase"]) {
      assert.ok(runNames.includes(expected), `fookie_run is missing ${expected}`);
    }

    const outboxCols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'fookie_outbox'",
    );
    const outboxNames = outboxCols.rows.map((row) => String(row.column_name));
    for (const expected of [
      "step_index",
      "step",
      "next_attempt_at",
      "error",
      "compensation_of",
      "dispatched_at",
    ]) {
      assert.ok(outboxNames.includes(expected), `fookie_outbox is missing ${expected}`);
    }

    await fookie.stop();
  });

  it("indexes relation and flagged columns but not plain ones", async () => {
    const fookie = boot();
    await fookie.list(order, {});

    const names = await indexNames("pg_saga_order");
    assert.ok(names.includes("pg_saga_order_buyer_idx"), `relation index missing from ${names}`);
    assert.ok(names.includes("pg_saga_order_sku_idx"), `flagged index missing from ${names}`);
    assert.equal(
      names.some((name) => name.includes("amount")),
      false,
    );

    const ownerNames = await indexNames("pg_saga_owner");
    assert.ok(ownerNames.includes("pg_saga_owner_email_uidx"), `unique index missing`);

    await fookie.stop();
  });

  it("writes a real run row and outbox row when a flow suspends", async () => {
    const fookie = boot();
    const buyer = await fookie.create(owner, { email: `saga-${Date.now()}@example.com` });
    assert.equal(buyer.signal, "done");
    if (buyer.signal !== "done") {
      throw new Error("buyer create must succeed");
    }

    const created = await fookie.create(order, { amount: 42, sku: "SKU-1", buyer: buyer.id });
    assert.equal(created.signal, "running");

    const runRow = await pool.query("SELECT * FROM public.fookie_run WHERE run_id = $1", [
      created.runId,
    ]);
    assert.equal(runRow.rowCount, 1);
    for (const row of runRow.rows) {
      assert.equal(String(row.model), "PgSagaOrder");
      assert.equal(String(row.operation), "create");
      assert.equal(String(row.saga_phase), "forward");
    }

    const outboxRow = await pool.query(
      "SELECT * FROM public.fookie_outbox WHERE run_id = $1 ORDER BY step_index",
      [created.runId],
    );
    assert.equal(outboxRow.rowCount, 1);
    for (const row of outboxRow.rows) {
      assert.equal(String(row.name), "pgsaga.charge");
      assert.equal(String(row.status), "pending");
      assert.equal(Number(row.step_index), 0);
      assert.notEqual(row.dispatched_at, null);
    }

    await fookie.stop();
  });

  it("advances the saga to a second step through real rows", async () => {
    const fookie = boot();
    const buyer = await fookie.create(owner, { email: `saga2-${Date.now()}@example.com` });
    assert.equal(buyer.signal, "done");
    if (buyer.signal !== "done") {
      throw new Error("buyer create must succeed");
    }
    const created = await fookie.create(order, { amount: 7, sku: "SKU-2", buyer: buyer.id });
    assert.equal(created.signal, "running");

    const first = await pool.query(
      "SELECT external_id FROM public.fookie_outbox WHERE run_id = $1 AND step_index = 0",
      [created.runId],
    );
    assert.equal(first.rowCount, 1);
    for (const row of first.rows) {
      const accepted = await fookie.setExternalResult({
        externalId: String(row.external_id),
        output: { reference: "ref-1" },
      });
      assert.equal(accepted, true);
    }

    const second = await pool.query(
      "SELECT name, step_index, status FROM public.fookie_outbox WHERE run_id = $1 AND step_index = 1",
      [created.runId],
    );
    assert.equal(second.rowCount, 1);
    for (const row of second.rows) {
      assert.equal(String(row.name), "pgsaga.settle");
      assert.equal(String(row.status), "pending");
    }

    const completed = await pool.query(
      "SELECT status FROM public.fookie_outbox WHERE run_id = $1 AND step_index = 0",
      [created.runId],
    );
    for (const row of completed.rows) {
      assert.equal(String(row.status), "completed");
    }

    await fookie.stop();
  });

  it("compensates a failed step and records the undo row", async () => {
    const fookie = boot();
    const buyer = await fookie.create(owner, { email: `saga3-${Date.now()}@example.com` });
    assert.equal(buyer.signal, "done");
    if (buyer.signal !== "done") {
      throw new Error("buyer create must succeed");
    }
    const created = await fookie.create(order, { amount: 11, sku: "SKU-3", buyer: buyer.id });
    assert.equal(created.signal, "running");

    const first = await pool.query(
      "SELECT external_id FROM public.fookie_outbox WHERE run_id = $1 AND step_index = 0",
      [created.runId],
    );
    for (const row of first.rows) {
      await fookie.setExternalResult({
        externalId: String(row.external_id),
        output: { reference: "ref-2" },
      });
    }

    const second = await pool.query(
      "SELECT external_id FROM public.fookie_outbox WHERE run_id = $1 AND step_index = 1",
      [created.runId],
    );
    assert.equal(second.rowCount, 1);
    for (const row of second.rows) {
      const recorded = await fookie.setExternalFailure({
        externalId: String(row.external_id),
        reason: "gateway down",
        failure: FailureClass.Permanent,
      });
      assert.equal(recorded, true);
    }

    const undo = await pool.query(
      "SELECT name, compensation_of FROM public.fookie_outbox WHERE run_id = $1 AND compensation_of IS NOT NULL",
      [created.runId],
    );
    assert.equal(undo.rowCount, 1);
    for (const row of undo.rows) {
      assert.equal(String(row.name), "pgsaga.refund");
    }

    const phase = await pool.query("SELECT saga_phase FROM public.fookie_run WHERE run_id = $1", [
      created.runId,
    ]);
    for (const row of phase.rows) {
      assert.equal(String(row.saga_phase), "compensating");
    }

    await fookie.stop();
  });
});
