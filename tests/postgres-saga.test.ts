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

const note = Model({
  name: "PgFkNote",
  fields: { title: z.string(), owner: Types.relation({ name: "PgFkParent" }) },
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

const fkParent = Model({
  name: "PgFkParent",
  fields: { email: z.string().email() },
  flow: {
    async create(flow) {
      const child = await flow.create(note, { title: "n", owner: flow.id });
      return child.signal;
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

describe("postgres foreign keys", { skip: databaseUrl.length === 0 }, () => {
  let pool: pg.Pool;

  before(() => {
    pool = new pg.Pool({ connectionString: databaseUrl });
  });

  after(async () => {
    await pool.end();
  });

  function boot() {
    return app({
      listen: "0",
      database: databaseUrl,
      models: [fkParent, note],
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

  it("declares a deferrable restrict constraint for every relation", async () => {
    const fookie = boot();
    await fookie.list(note, {});

    const found = await pool.query(
      `SELECT c.conname, c.condeferrable, c.condeferred, c.confdeltype
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'pg_fk_note' AND c.contype = 'f'`,
    );
    assert.equal(found.rowCount, 1);
    for (const row of found.rows) {
      assert.equal(String(row.conname), "pg_fk_note_owner_fk");
      assert.equal(row.condeferrable, true, "must be DEFERRABLE");
      assert.equal(row.condeferred, true, "must be INITIALLY DEFERRED");
      assert.equal(String(row.confdeltype), "r", "must be ON DELETE RESTRICT");
    }
    await fookie.stop();
  });

  it("lets a nested create write the child before the parent", async () => {
    const fookie = boot();
    const created = await fookie.create(fkParent, { email: `fk-${Date.now()}@example.com` });
    assert.equal(created.signal, "done");

    const child = await pool.query("SELECT owner FROM public.pg_fk_note WHERE owner = $1", [
      created.id,
    ]);
    assert.equal(child.rowCount, 1, "the child points at a parent that really exists");
    await fookie.stop();
  });

  it("refuses an orphan id", async () => {
    const fookie = boot();
    await fookie.list(note, {});
    let rejected = "";
    try {
      await pool.query(
        "INSERT INTO public.pg_fk_note (id, owner, title, created_at, updated_at, is_deleted) VALUES ($1, $2, 'x', NOW(), NOW(), false)",
        ["00000000-0000-7000-8000-000000000123", "00000000-0000-7000-8000-000000000999"],
      );
    } catch (err) {
      rejected = String(err);
    }
    assert.match(rejected, /foreign key/i);
    await fookie.stop();
  });
});

describe("postgres concurrent lists", { skip: databaseUrl.length === 0 }, () => {
  let pool: pg.Pool;

  before(() => {
    pool = new pg.Pool({ connectionString: databaseUrl });
  });

  after(async () => {
    await pool.end();
  });

  it("gives each concurrent caller only its own rows", async () => {
    const fookie = app({
      listen: "0",
      database: databaseUrl,
      models: [owner],
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

    const stamp = Date.now();
    const left = `conc-a-${stamp}@example.com`;
    const right = `conc-b-${stamp}@example.com`;
    assert.equal((await fookie.create(owner, { email: left })).signal, "done");
    assert.equal((await fookie.create(owner, { email: right })).signal, "done");

    const [first, second] = await Promise.all([
      fookie.list(owner, { email: { eq: left } }),
      fookie.list(owner, { email: { eq: right } }),
    ]);

    assert.deepEqual(
      (first?.results ?? []).map((row) => row.email),
      [left],
    );
    assert.deepEqual(
      (second?.results ?? []).map((row) => row.email),
      [right],
    );
    await fookie.stop();
  });
});
