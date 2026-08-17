import assert from "node:assert/strict";
import { test } from "node:test";
import { AbsentText } from "../../postgresql/src/rows.ts";
import { MockDb } from "./mock-pool.ts";
import { classify, unquoteIdents } from "./mock-sql.ts";
import { outboxRowFromParams, runRowFromParams } from "./mock-rows.ts";

test("first FROM table decides outbox vs run even when both names appear", () => {
  const sql = unquoteIdents(
    `SELECT external_id FROM public.fookie_outbox WHERE status <> 'completed' OR run_id IN (SELECT run_id FROM public.fookie_run WHERE saga_phase NOT IN ('completed', 'compensated'))`,
  );
  const statement = classify(sql);
  assert.equal(statement.kind, "select-outbox");
});

test("pending outbox insert maps named columns without a positional shift", () => {
  const row = outboxRowFromParams(
    [
      "ext-1",
      "fraud.score",
      "pending",
      JSON.stringify({ amount: 3 }),
      "ent-1",
      "User",
      "run-1",
      2,
      0,
      "compensatable",
      AbsentText,
      AbsentText,
      AbsentText,
      AbsentText,
    ],
    false,
  );
  assert.equal(row.external_id, "ext-1");
  assert.equal(row.attempt, 2);
  assert.equal(row.step_index, 0);
  assert.equal(row.output, null);
  assert.equal(row.compensation_of, null);
});

test("completed outbox insert keeps output on its own column", () => {
  const row = outboxRowFromParams(
    [
      "ext-2",
      "fraud.score",
      "completed",
      JSON.stringify({ amount: 3 }),
      JSON.stringify({ score: 9 }),
      "ent-1",
      "User",
      "run-1",
      1,
      0,
      "compensatable",
      AbsentText,
      AbsentText,
      AbsentText,
      AbsentText,
    ],
    true,
  );
  assert.equal(row.attempt, 1);
  assert.deepEqual(row.output, { score: 9 });
});

test("missing insert params throw instead of becoming empty strings", () => {
  assert.throws(() => runRowFromParams(["run-1", "User"]));
});

test("MockDb pending outbox sql writes attempt from the unbound-output column list", async () => {
  const db = new MockDb();
  const sql = `INSERT INTO public.fookie_outbox (external_id, name, status, input, output, entity_id, model, run_id, attempt, step_index, step, next_attempt_at, error, compensation_of, dispatched_at)
    VALUES ($1, $2, $3, $4::jsonb, NULL::jsonb, $5, $6, $7, $8, $9, $10, NULLIF($11, '__fookie_absent__')::timestamptz, NULLIF($12, '__fookie_absent__'), NULLIF($13, '__fookie_absent__'), NULLIF($14, '__fookie_absent__')::timestamptz)`;
  await db.query(sql, [
    "ext-3",
    "notify.send",
    "pending",
    JSON.stringify({ to: "a@b.com" }),
    "ent-9",
    "Mail",
    "run-9",
    4,
    1,
    "compensatable",
    AbsentText,
    AbsentText,
    AbsentText,
    AbsentText,
  ]);
  const stored = db.outbox.get("ext-3");
  assert.equal(stored?.attempt, 4);
  assert.equal(stored?.step_index, 1);
  assert.equal(stored?.entity_id, "ent-9");
  assert.equal(stored?.output, null);
});
