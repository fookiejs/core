import { z } from "zod";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { Done, Model, app } from "../src/index.ts";
import { ddlLockTimeoutMs } from "../src/observability.ts";
import { Postgres } from "./engines.ts";
import { ensureTestPostgres } from "./postgres-env.ts";

const databaseUrl = await ensureTestPostgres();

const gate = Model({
  name: "SchemaGate",
  fields: { label: z.string() },
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

describe("schema sync under a held lock", () => {
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
      models: [gate],
      externals: [] as const,
      onExternalEvent: async () => {},
    });
  }

  it("gives up on the lock instead of queueing behind an open transaction", async () => {
    const first = boot();
    assert.equal(await first.ready(), true, "the table has to exist before we can block on it");
    await first.stop();

    const blocker = await pool.connect();
    await blocker.query("BEGIN");
    await blocker.query("SELECT label FROM public.schema_gate LIMIT 1");

    const blocked = boot();
    const startedAt = Date.now();
    const readyUnderLock = await blocked.ready();
    const waited = Date.now() - startedAt;

    assert.equal(readyUnderLock, false, "a blocked schema sync must report not ready");
    assert.ok(
      waited >= ddlLockTimeoutMs - 500,
      `the sync must actually wait for the lock, waited ${String(waited)}ms`,
    );
    assert.ok(
      waited < ddlLockTimeoutMs * 3,
      `the sync must give up rather than hang, waited ${String(waited)}ms`,
    );

    await blocker.query("COMMIT");
    blocker.release();

    assert.equal(await blocked.ready(), true, "once the lock clears the next attempt succeeds");
    const created = await blocked.create(gate, { label: "after the lock cleared" });
    assert.equal(created.signal, "done");

    await blocked.stop();
  });

  it("serves reads from a second node while the first holds a write open", async () => {
    const reader = boot();
    assert.equal(await reader.ready(), true);

    const holder = await pool.connect();
    await holder.query("BEGIN");
    await holder.query("SELECT label FROM public.schema_gate LIMIT 1");

    const listed = await reader.list(gate, {});
    assert.equal(listed.signal, "done", "a warm node must not block behind someone else's read");

    await holder.query("COMMIT");
    holder.release();
    await reader.stop();
  });
});
