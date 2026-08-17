import { z } from "zod";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { Done, External, FailureClass, Model, app } from "../src/index.ts";
import { Postgres } from "./engines.ts";
import { ensureTestPostgres } from "./postgres-env.ts";

const databaseUrl = await ensureTestPostgres();

const releaseStock = External({
  name: "walk.release_stock",
  input: { holdId: z.string() },
  output: { released: z.boolean() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const reserveStock = External({
  name: "walk.reserve_stock",
  input: { sku: z.string() },
  output: { holdId: z.string() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
  compensate: releaseStock,
});

const voidCard = External({
  name: "walk.void_card",
  input: { authId: z.string() },
  output: { voided: z.boolean() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const authorizeCard = External({
  name: "walk.authorize_card",
  input: { amount: z.number().finite().nonnegative() },
  output: { authId: z.string() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
  compensate: voidCard,
});

const cancelCarrier = External({
  name: "walk.cancel_carrier",
  input: { bookingId: z.string() },
  output: { cancelled: z.boolean() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const bookCarrier = External({
  name: "walk.book_carrier",
  input: { sku: z.string() },
  output: { bookingId: z.string() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
  compensate: cancelCarrier,
});

const captureCard = External({
  name: "walk.capture_card",
  input: { authId: z.string() },
  output: { captured: z.boolean() },
  attempts: 2,
  backoff: "fixed",
  timeoutMs: 30_000,
});

const externals = [
  reserveStock,
  releaseStock,
  authorizeCard,
  voidCard,
  bookCarrier,
  cancelCarrier,
  captureCard,
] as const;

const parcel = Model({
  name: "WalkParcel",
  fields: { sku: z.string(), amount: z.number().finite().nonnegative() },
  flow: {
    async create(flow) {
      const held = await flow.external(reserveStock, { sku: flow.body.sku });
      if (held.signal !== "done") {
        return held.signal;
      }
      const authorized = await flow.external(authorizeCard, { amount: flow.body.amount });
      if (authorized.signal !== "done") {
        return authorized.signal;
      }
      const booked = await flow.external(bookCarrier, { sku: flow.body.sku });
      if (booked.signal !== "done") {
        return booked.signal;
      }
      const captured = await flow.external(captureCard, { authId: authorized.output.authId });
      return captured.signal;
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

describe("a failed saga is unwound all the way back", () => {
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
      models: [parcel],
      externals: [...externals],
      onExternalEvent: async () => {},
    });
  }

  async function stepId(runId: string, stepIndex: number): Promise<string> {
    const found = await pool.query(
      "SELECT external_id FROM public.fookie_outbox WHERE run_id = $1 AND step_index = $2 AND compensation_of IS NULL",
      [runId, stepIndex],
    );
    assert.equal(found.rowCount, 1, `step ${String(stepIndex)} must exist exactly once`);
    return String(found.rows[0].external_id);
  }

  async function undoNames(runId: string): Promise<readonly string[]> {
    const found = await pool.query(
      "SELECT name FROM public.fookie_outbox WHERE run_id = $1 AND compensation_of IS NOT NULL ORDER BY name",
      [runId],
    );
    return found.rows.map((row) => String(row.name));
  }

  it("undoes every completed step when the last one dead letters", async () => {
    const fookie = boot();
    await fookie.ready();

    const placed = await fookie.create(parcel, { sku: "WALK-1", amount: 42 });
    assert.equal(placed.signal, "running", "the first external suspends the flow");
    if (placed.signal !== "running") {
      throw new Error("the flow must suspend");
    }
    const runId = placed.runId;

    await fookie.setExternalResult({
      externalId: await stepId(runId, 0),
      output: { holdId: "hold-1" },
    });
    await fookie.setExternalResult({
      externalId: await stepId(runId, 1),
      output: { authId: "auth-1" },
    });
    await fookie.setExternalResult({
      externalId: await stepId(runId, 2),
      output: { bookingId: "book-1" },
    });

    const failed = await fookie.setExternalFailure({
      externalId: await stepId(runId, 3),
      reason: "the bank suspended the capture",
      failure: FailureClass.Permanent,
    });
    assert.equal(failed, true, "the failure has to be recorded");

    const undone = await undoNames(runId);
    assert.deepEqual(
      undone,
      ["walk.cancel_carrier", "walk.release_stock", "walk.void_card"],
      `three completed steps were undone by ${String(undone.length)} compensations: ${undone.join(", ")}`,
    );

    const settled = await pool.query(
      "SELECT status FROM public.fookie_outbox WHERE run_id = $1 AND compensation_of IS NOT NULL",
      [runId],
    );
    for (const row of settled.rows) {
      assert.equal(
        String(row.status),
        "pending",
        "each undo is dispatched and waits for its handler, rather than being skipped",
      );
    }

    await fookie.stop();
  });

  it("leaves nothing reserved or authorised behind when the money step is the one that fails", async () => {
    const fookie = boot();
    await fookie.ready();

    const placed = await fookie.create(parcel, { sku: "WALK-2", amount: 7 });
    if (placed.signal !== "running") {
      throw new Error("the flow must suspend");
    }
    const runId = placed.runId;

    await fookie.setExternalResult({
      externalId: await stepId(runId, 0),
      output: { holdId: "hold-2" },
    });
    await fookie.setExternalResult({
      externalId: await stepId(runId, 1),
      output: { authId: "auth-2" },
    });

    await fookie.setExternalFailure({
      externalId: await stepId(runId, 2),
      reason: "no carrier would take it",
      failure: FailureClass.Permanent,
    });

    const undone = await undoNames(runId);
    assert.ok(
      undone.includes("walk.void_card"),
      `the card authorisation must be voided, saw ${undone.join(", ")}`,
    );
    assert.ok(
      undone.includes("walk.release_stock"),
      `the stock hold must be released, saw ${undone.join(", ")}`,
    );

    await fookie.stop();
  });

  it("undoes the one completed step and stops there when only one ran", async () => {
    const fookie = boot();
    await fookie.ready();

    const placed = await fookie.create(parcel, { sku: "WALK-3", amount: 3 });
    if (placed.signal !== "running") {
      throw new Error("the flow must suspend");
    }
    const runId = placed.runId;

    await fookie.setExternalResult({
      externalId: await stepId(runId, 0),
      output: { holdId: "hold-3" },
    });
    await fookie.setExternalFailure({
      externalId: await stepId(runId, 1),
      reason: "the card was declined",
      failure: FailureClass.Permanent,
    });

    const undone = await undoNames(runId);
    assert.deepEqual(undone, ["walk.release_stock"], "a step nothing preceded needs one undo");

    await fookie.stop();
  });

  it("does not undo a step that has no compensation declared", async () => {
    const fookie = boot();
    await fookie.ready();

    const placed = await fookie.create(parcel, { sku: "WALK-4", amount: 9 });
    if (placed.signal !== "running") {
      throw new Error("the flow must suspend");
    }
    const runId = placed.runId;

    await fookie.setExternalFailure({
      externalId: await stepId(runId, 0),
      reason: "out of stock",
      failure: FailureClass.Permanent,
    });

    const undone = await undoNames(runId);
    assert.deepEqual(undone, [], "nothing ran before it, so nothing may be undone");

    await fookie.stop();
  });
});
