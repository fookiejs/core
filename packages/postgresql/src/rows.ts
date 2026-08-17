import { z } from "zod";
import pg from "pg";
import { entityRecordFromJson, firstPresent, isOutboxStatus, isSagaPhase, jsonObjectFromHost, pgCellToString } from "@fookiejs/core";
import type { HostValue, OutboxEntry, OutboxSaga, PgParam, RunStateRow } from "@fookiejs/core";

export type { RunStateRow } from "@fookiejs/core";

export function outboxAttempt(raw: HostValue): readonly number[] {
  const asNumber = z.number().int().min(1).safeParse(raw);
  if (asNumber.success === true) {
    return [asNumber.data];
  }
  try {
    const asString = pgCellToString(raw);
    const parsed = z.coerce.number().int().min(1).safeParse(asString);
    if (parsed.success === true) {
      return [parsed.data];
    }
  } catch {
    return [];
  }
  return [];
}

export const outboxColumns =
  "external_id, name, status, input, output, entity_id, model, run_id, attempt, step_index, step, next_attempt_at, error, compensation_of, dispatched_at";

export const runColumns =
  "run_id, model, entity_id, operation, body, filter, saga_phase, pivot_external_id, error, updated_at";

export const AbsentText = "__fookie_absent__";

export function firstTextOrAbsent(texts: readonly string[]): PgParam {
  if (Array.isArray(texts) === false) {
    return AbsentText;
  }
  for (const text of texts) {
    if (z.string().min(1).safeParse(text).success === true) {
      return text;
    }
  }
  return AbsentText;
}

function optionalText(cell: HostValue): readonly string[] {
  const parsed = z.string().min(1).safeParse(cell);
  if (parsed.success === false) {
    return [];
  }
  if (parsed.data === AbsentText) {
    return [];
  }
  return [parsed.data];
}

function optionalTimestamp(cell: HostValue): readonly string[] {
  if (cell instanceof Date) {
    if (Number.isFinite(cell.getTime()) === false) {
      return [];
    }
    return [cell.toISOString()];
  }
  const parsed = z.string().min(1).safeParse(cell);
  if (parsed.success === false) {
    return [];
  }
  return [parsed.data];
}

function sagaFromRow(row: pg.QueryResultRow): OutboxSaga {
  const stepIndexParse = z.coerce.number().int().min(0).safeParse(row.step_index);
  let stepIndex = 0;
  if (stepIndexParse.success === true) {
    stepIndex = stepIndexParse.data;
  }
  let undoable = false;
  for (const stepText of optionalText(row.step)) {
    if (stepText === "compensatable") {
      undoable = true;
    }
  }
  return {
    stepIndex,
    undoable,
    nextAttemptAt: optionalTimestamp(row.next_attempt_at),
    error: optionalText(row.error),
    compensationOf: optionalText(row.compensation_of),
    dispatchedAt: optionalTimestamp(row.dispatched_at),
  };
}

export function runStateFromRow(row: pg.QueryResultRow): readonly RunStateRow[] {
  try {
    const phaseText = pgCellToString(row.saga_phase);
    if (isSagaPhase(phaseText) === false) {
      return [];
    }
    const bodyHits = jsonObjectFromHost(row.body);
    if (bodyHits.length < 1) {
      return [];
    }
    return [
      {
        runId: pgCellToString(row.run_id),
        model: pgCellToString(row.model),
        entityId: pgCellToString(row.entity_id),
        operation: pgCellToString(row.operation),
        body: firstPresent(bodyHits, "run body required"),
        filterJson: pgCellToString(row.filter),
        phase: phaseText,
        pivotExternalId: optionalText(row.pivot_external_id),
        error: optionalText(row.error),
        updatedAt: optionalTimestamp(row.updated_at),
      },
    ];
  } catch {
    return [];
  }
}

export function outboxEntryFromRow(row: pg.QueryResultRow): readonly OutboxEntry[] {
  try {
    const status = pgCellToString(row.status);
    const externalId = pgCellToString(row.external_id);
    const name = pgCellToString(row.name);
    const entityId = pgCellToString(row.entity_id);
    const model = pgCellToString(row.model);
    const runId = pgCellToString(row.run_id);
    const inputHits = entityRecordFromJson(row.input);
    const attemptHits = outboxAttempt(row.attempt);
    if (isOutboxStatus(status) === false || inputHits.length < 1 || attemptHits.length < 1) {
      return [];
    }
    const input = firstPresent(inputHits, "outbox input required");
    const saga = sagaFromRow(row);
    let attempt = 0;
    for (const hit of attemptHits) {
      attempt = hit;
    }
    if (status !== "completed") {
      return [
        {
          externalId,
          name,
          entityId,
          model,
          runId,
          attempt,
          input,
          stepIndex: saga.stepIndex,
          undoable: saga.undoable,
          nextAttemptAt: saga.nextAttemptAt,
          error: saga.error,
          compensationOf: saga.compensationOf,
          dispatchedAt: saga.dispatchedAt,
          status,
        },
      ];
    }
    const outputHits = entityRecordFromJson(row.output);
    if (outputHits.length < 1) {
      return [];
    }
    const output = firstPresent(outputHits, "outbox output required");
    return [
      {
        externalId,
        name,
        entityId,
        model,
        runId,
        attempt,
        input,
        stepIndex: saga.stepIndex,
        undoable: saga.undoable,
        nextAttemptAt: saga.nextAttemptAt,
        error: saga.error,
        compensationOf: saga.compensationOf,
        dispatchedAt: saga.dispatchedAt,
        status: "completed",
        output,
      },
    ];
  } catch {
    return [];
  }
}
