import { z } from "zod";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { Done, External, Model, Running, app } from "../src/index.ts";
import type { ExternalEventOf } from "../src/index.ts";
import { Postgres } from "./engines.ts";
import { ensureTestPostgres } from "./postgres-env.ts";

const databaseUrl = await ensureTestPostgres();

const clearance = External({
  name: "suspend.clear",
  input: { note: z.string() },
  output: { cleared: z.boolean() },
  attempts: 3,
  backoff: "fixed",
  timeoutMs: 10_000,
});

const externals = [clearance] as const;

const shipment = Model({
  name: "SuspendShipment",
  fields: { label: z.string() },
  flow: {
    async create(flow) {
      const logged = await flow.create(shipmentLog, { message: "queued" });
      if (logged.signal === Running) {
        return Running;
      }
      const cleared = await flow.external(clearance, { note: flow.body.label });
      if (cleared.signal === Running) {
        return Running;
      }
      if (cleared.signal === Done) {
        return Done;
      }
      return cleared.signal;
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

const shipmentLog = Model({
  name: "SuspendShipmentLog",
  fields: { shipment: shipment, message: z.string() },
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

describe("nested create before a suspend", () => {
  let pool: pg.Pool;

  before(() => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 6 });
  });

  after(async () => {
    await pool.end();
  });

  function boot(queue: ExternalEventOf<(typeof externals)[number]>[]) {
    return app({
      listen: "0",
      database: Postgres(databaseUrl, [
        {
          query: (sql: string, params?: unknown[]) => pool.query(sql, params),
          connect: () => pool.connect(),
          end: [],
        },
      ]),
      models: [shipment, shipmentLog],
      externals: [...externals],
      onExternalEvent: async (event) => {
        queue.push(event);
      },
    });
  }

  it("survives a flow that creates a child and then suspends", async () => {
    const queue: ExternalEventOf<(typeof externals)[number]>[] = [];
    const fookie = boot(queue);
    await fookie.ready();
    await pool.query("DELETE FROM public.suspend_shipment_log");
    await pool.query("DELETE FROM public.suspend_shipment");

    const placed = await fookie.create(shipment, { label: "first" });
    assert.equal(placed.signal, "running", "the external suspends the flow");
    if (placed.signal !== "running") {
      throw new Error("the flow was expected to suspend");
    }

    assert.equal(queue.length, 1, "the external was dispatched");
    for (const event of queue) {
      const accepted = await fookie.setExternalResult({
        externalId: event.externalId,
        output: { cleared: true },
      });
      assert.equal(accepted, true, "the resumed run must not fail");
    }

    const shipments = await pool.query("SELECT id FROM public.suspend_shipment");
    assert.equal(shipments.rowCount, 1, "the shipment has to exist once the flow completed");

    const logs = await pool.query(
      "SELECT shipment FROM public.suspend_shipment_log WHERE is_deleted = false",
    );
    assert.equal(logs.rowCount, 1, "exactly one child, not one per replayed pass");
    for (const row of logs.rows) {
      assert.equal(
        String(row.shipment),
        String(shipments.rows[0]?.id),
        "the child must point at the shipment that was finally written",
      );
    }

    await fookie.stop();
  });

  it("leaves nothing behind when the suspended flow never completes", async () => {
    const queue: ExternalEventOf<(typeof externals)[number]>[] = [];
    const fookie = boot(queue);
    await fookie.ready();
    await pool.query("DELETE FROM public.suspend_shipment_log");
    await pool.query("DELETE FROM public.suspend_shipment");

    const placed = await fookie.create(shipment, { label: "abandoned" });
    assert.equal(placed.signal, "running");

    const orphans = await pool.query(
      "SELECT id FROM public.suspend_shipment_log WHERE is_deleted = false",
    );
    assert.equal(
      orphans.rowCount,
      0,
      "a child of an operation that has not completed must not be readable",
    );
    const parents = await pool.query("SELECT id FROM public.suspend_shipment");
    assert.equal(parents.rowCount, 0, "nor may the parent appear before the flow finishes");

    await fookie.stop();
  });
});
