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

      const firstPage = await fookie.outboxList({ status: [], runId: [], limit: 2, offset: 0 });
      assert.equal(firstPage.length, 2, "the page respects its limit");

      const newest = madeRunIds.toSorted().toReversed();
      const wanted = newest.slice(0, 2);
      const answered: string[] = [];
      for (const row of firstPage) {
        answered.push(row.runId);
      }
      assert.deepEqual(
        answered.toSorted().toReversed(),
        wanted,
        "an operator asking for two rows must be handed the two most recent",
      );

      const olderRun = madeRunIds.toSorted()[0];
      assert.ok(olderRun !== undefined, "the oldest run has to exist to be excluded");
      assert.equal(
        answered.includes(String(olderRun)),
        false,
        "the first page must not open on ancient history",
      );

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
