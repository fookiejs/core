import { z } from "zod";
import type { OutboxEntry } from "@fookiejs/core";
import { DatabaseError } from "@fookiejs/core";
import type { RunStateRow } from "@fookiejs/core";
import { isOutboxStatus } from "@fookiejs/core";
import { pageBound } from "@fookiejs/core";
import { isSagaPhase } from "@fookiejs/core";
import type { OutboxStatus } from "@fookiejs/core";
import { firstPresent } from "@fookiejs/core";
import { jsonWireSchema, entityRecordFromJson, jsonObjectFromHost } from "@fookiejs/core";
import type { JsonValue } from "@fookiejs/core";

export function compareOutboxOrder(left: OutboxEntry, right: OutboxEntry): number {
  if (z.string().min(1).safeParse(left.runId).success === false) {
    return compareText(left.runId, right.runId);
  }
  const byRun = compareText(right.runId, left.runId);
  if (byRun !== 0) {
    return byRun;
  }
  return left.stepIndex - right.stepIndex;
}

export function compareText(left: string, right: string): number {
  if (z.string().safeParse(left).success === false) {
    return 0;
  }
  if (z.string().safeParse(right).success === false) {
    return 0;
  }
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function lastStamp(stamps: readonly string[]): readonly string[] {
  if (Array.isArray(stamps) === false) {
    throw DatabaseError.create("run stamps required");
  }
  let last: readonly string[] = [];
  for (const stamp of stamps) {
    last = [stamp];
  }
  return last;
}

export function compareRunOrder(left: RunStateRow, right: RunStateRow): number {
  const leftAt = lastStamp(left.updatedAt);
  const rightAt = lastStamp(right.updatedAt);
  if (leftAt.length > 0 && rightAt.length > 0) {
    const byTime = compareText(
      firstPresent(rightAt, "run updatedAt required"),
      firstPresent(leftAt, "run updatedAt required"),
    );
    if (byTime !== 0) {
      return byTime;
    }
  }
  return compareText(left.runId, right.runId);
}

export function slicePage<T>(rows: readonly T[], limit: number, offset: number): T[] {
  if (Array.isArray(rows) === false) {
    return [];
  }
  const start = pageBound(offset);
  const size = pageBound(limit);
  if (start < 0 || size < 0) {
    return [];
  }
  return rows.slice(start, start + size);
}

function parseJsonObject(raw: string): readonly JsonValue[] {
  try {
    const parsed = JSON.parse(raw);
    const wire = jsonWireSchema.safeParse(parsed);
    if (wire.success === false) {
      return [];
    }
    return [wire.data];
  } catch {
    return [];
  }
}

const outboxShape = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  entityId: z.string().min(1),
  model: z.string().min(1),
  runId: z.string().min(1),
  attempt: z.number().int().min(1),
  status: z.string().min(1),
  input: z.record(z.string(), jsonWireSchema),
  stepIndex: z.number().int().min(0),
  undoable: z.boolean(),
  nextAttemptAt: z.array(z.string()),
  error: z.array(z.string()),
  compensationOf: z.array(z.string()),
  dispatchedAt: z.array(z.string()),
});

const completedOutputShape = z.object({
  output: z.record(z.string(), jsonWireSchema),
});

export function parseOutbox(raw: string): readonly OutboxEntry[] {
  const jsonHits = parseJsonObject(raw);
  if (jsonHits.length < 1) {
    return [];
  }
  for (const json of jsonHits) {
    const parsed = outboxShape.safeParse(json);
    if (parsed.success === false) {
      return [];
    }
    if (isOutboxStatus(parsed.data.status) === false) {
      return [];
    }
    const status: OutboxStatus = parsed.data.status;
    const inputHits = entityRecordFromJson(parsed.data.input);
    if (inputHits.length < 1) {
      return [];
    }
    for (const input of inputHits) {
      if (status !== "completed") {
        return [
          {
            externalId: parsed.data.externalId,
            name: parsed.data.name,
            entityId: parsed.data.entityId,
            model: parsed.data.model,
            runId: parsed.data.runId,
            attempt: parsed.data.attempt,
            input,
            stepIndex: parsed.data.stepIndex,
            undoable: parsed.data.undoable,
            nextAttemptAt: parsed.data.nextAttemptAt,
            error: parsed.data.error,
            compensationOf: parsed.data.compensationOf,
            dispatchedAt: parsed.data.dispatchedAt,
            status,
          },
        ];
      }
      const outputParsed = completedOutputShape.safeParse(json);
      if (outputParsed.success === false) {
        return [];
      }
      const outputHits = entityRecordFromJson(outputParsed.data.output);
      if (outputHits.length < 1) {
        return [];
      }
      for (const output of outputHits) {
        return [
          {
            externalId: parsed.data.externalId,
            name: parsed.data.name,
            entityId: parsed.data.entityId,
            model: parsed.data.model,
            runId: parsed.data.runId,
            attempt: parsed.data.attempt,
            input,
            stepIndex: parsed.data.stepIndex,
            undoable: parsed.data.undoable,
            nextAttemptAt: parsed.data.nextAttemptAt,
            error: parsed.data.error,
            compensationOf: parsed.data.compensationOf,
            dispatchedAt: parsed.data.dispatchedAt,
            status: "completed",
            output,
          },
        ];
      }
    }
  }
  return [];
}

const runShape = z.object({
  runId: z.string().min(1),
  model: z.string().min(1),
  entityId: z.string().min(1),
  operation: z.string().min(1),
  body: z.record(z.string(), jsonWireSchema),
  filterJson: z.string(),
  phase: z.string().min(1),
  pivotExternalId: z.array(z.string()),
  error: z.array(z.string()),
  updatedAt: z.array(z.string()),
});

export function parseRun(raw: string): readonly RunStateRow[] {
  const jsonHits = parseJsonObject(raw);
  if (jsonHits.length < 1) {
    return [];
  }
  for (const json of jsonHits) {
    const parsed = runShape.safeParse(json);
    if (parsed.success === false) {
      return [];
    }
    if (isSagaPhase(parsed.data.phase) === false) {
      return [];
    }
    const bodyHits = jsonObjectFromHost(parsed.data.body);
    if (bodyHits.length < 1) {
      return [];
    }
    for (const body of bodyHits) {
      return [
        {
          runId: parsed.data.runId,
          model: parsed.data.model,
          entityId: parsed.data.entityId,
          operation: parsed.data.operation,
          body,
          filterJson: parsed.data.filterJson,
          phase: parsed.data.phase,
          pivotExternalId: parsed.data.pivotExternalId,
          error: parsed.data.error,
          updatedAt: parsed.data.updatedAt,
        },
      ];
    }
  }
  return [];
}
