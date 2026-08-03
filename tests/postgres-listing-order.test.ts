import { z } from "zod";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { Done, External, Model, Running, app } from "../src/index.ts";
import type { ExternalEventOf } from "../src/index.ts";

const databaseUrl = process.env.FOOKIE_TEST_DATABASE ?? "";

const ping = External({
  name: "order.ping",
  input: { label: z.string() },
  output: { seen: z.boolean() },
  attempts: 3,
  backoff: "fixed",
  timeoutMs: 10_000,
});

const externals = [ping] as const;

const ticket = Model({
  name: "OrderTicket",
  fields: { label: z.string() },
  flow: {
    async create(flow) {
      const seen = await flow.external(ping, { label: flow.body.label });
      if (seen.signal === Running) {
        return Running;
      }
      return seen.signal;
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

describe(
  "operator listings answer with the newest first",
  { skip: databaseUrl.length === 0 },
  () => {
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
        database: databaseUrl,
        models: [ticket],
        externals: [...externals],
        onExternalEvent: async (event) => {
          queue.push(event);
        },
        pool: [
          {
            query: (sql: string, params?: unknown[]) => pool.query(sql, params),
            connect: () => pool.connect(),
            end: [],
          },
        ],
      });
    }

    it("pages the outbox from the newest run rather than the oldest", async () => {
      const queue: ExternalEventOf<(typeof externals)[number]>[] = [];
      const fookie = boot(queue);
      await fookie.ready();
      await pool.query("DELETE FROM fookie_outbox WHERE model = $1", ["OrderTicket"]);
      await pool.query("DELETE FROM fookie_run WHERE model = $1", ["OrderTicket"]);
      await pool.query("DELETE FROM public.order_ticket");

      const madeRunIds: string[] = [];
      for (const label of ["first", "second", "third", "fourth", "fifth"]) {
        const placed = await fookie.create(ticket, { label });
        assert.equal(placed.signal, "running", "the external suspends each one");
        const seen = await fookie.runList({ phase: [], limit: 1, offset: 0 });
        for (const run of seen) {
          if (madeRunIds.includes(run.runId) === false) {
            madeRunIds.push(run.runId);
          }
        }
      }
      assert.equal(queue.length, 5, "every ticket dispatched its external");

      const listed = await fookie.outboxList({ status: [], runId: [], limit: 500, offset: 0 });
      assert.ok(listed.length > 0, "the listing has to answer with rows");

      let previous = "";
      for (const row of listed) {
        if (previous.length > 0) {
          assert.ok(
            row.runId <= previous,
            `runs must come back newest first, saw ${row.runId} after ${previous}`,
          );
        }
        previous = row.runId;
      }

      const ours: string[] = [];
      for (const row of listed) {
        if (madeRunIds.includes(row.runId) && ours.includes(row.runId) === false) {
          ours.push(row.runId);
        }
      }
      assert.equal(ours.length, madeRunIds.length, "every run this test made must be listed");
      assert.deepEqual(
        ours,
        madeRunIds.toSorted().toReversed(),
        "the newest of our runs has to be handed back before the oldest",
      );

      const firstPage = await fookie.outboxList({ status: [], runId: [], limit: 2, offset: 0 });
      assert.equal(firstPage.length, 2, "the page respects its limit");
      const oldestOverall = listed[listed.length - 1];
      assert.ok(oldestOverall !== undefined, "the listing must have a last row");
      for (const row of firstPage) {
        assert.ok(
          row.runId >= oldestOverall.runId,
          "the first page must not open on the oldest run in the table",
        );
      }
      await fookie.stop();
    });

    it("keeps the steps of one run in the order they ran", async () => {
      const queue: ExternalEventOf<(typeof externals)[number]>[] = [];
      const fookie = boot(queue);
      await fookie.ready();

      const rows = await fookie.outboxList({ status: [], runId: [], limit: 50, offset: 0 });
      let previousRun = "";
      let previousStep = -1;
      for (const row of rows) {
        if (row.runId !== previousRun) {
          previousRun = row.runId;
          previousStep = -1;
        }
        assert.ok(
          row.stepIndex >= previousStep,
          `steps within a run must not go backwards, saw ${String(row.stepIndex)} after ${String(previousStep)}`,
        );
        previousStep = row.stepIndex;
      }

      await fookie.stop();
    });
  },
);
