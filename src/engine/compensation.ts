import { z } from "zod";
import { compensationStepId } from "./ids.ts";
import { logDatabaseFailure } from "./flow.ts";
import { outboxPendingEntry, resolveExternalByName } from "./outbox.ts";
import type { OutboxEntry } from "./outbox.ts";
import type { Runtime } from "./runtime.ts";
import type { ExternalDef, InferExternalInputFrom } from "../external.ts";
import { obsScope } from "../observability.ts";
import { appendItem, catchValidation, firstPresent, mapLookup } from "../slot.ts";
import type { ScalarSchema } from "../types/type.ts";
import type { EntityRecord } from "../values.ts";

export function runRows(rt: Runtime, runId: string): readonly OutboxEntry[] {
  let rows: readonly OutboxEntry[] = [];
  for (const outboxRow of rt.outbox.values()) {
    if (outboxRow.runId === runId) {
      rows = appendItem(rows, outboxRow);
    }
  }
  return rows.toSorted((left, right) => left.stepIndex - right.stepIndex);
}

function compensationTargets(rt: Runtime, runId: string): readonly OutboxEntry[] {
  let undone: readonly OutboxEntry[] = [];
  const rows = runRows(rt, runId);
  for (const outboxRow of rows) {
    if (outboxRow.status !== "completed") {
      continue;
    }
    if (outboxRow.compensationOf.length > 0) {
      continue;
    }
    let alreadyUndone = false;
    for (const candidate of rows) {
      for (const forwardId of candidate.compensationOf) {
        if (forwardId === outboxRow.externalId) {
          alreadyUndone = true;
        }
      }
    }
    if (alreadyUndone === false) {
      undone = appendItem(undone, outboxRow);
    }
  }
  return undone.toSorted((left, right) => right.stepIndex - left.stepIndex);
}

function validatedUndoInput(
  undo: ExternalDef,
  context: EntityRecord,
): readonly InferExternalInputFrom<Record<string, ScalarSchema>>[] {
  if (z.looseObject({}).safeParse(context).success === false) {
    return [];
  }
  const hits = catchValidation(() => undo.validateInput(context));
  if (hits.length < 1) {
    return [];
  }
  for (const hit of hits) {
    return [hit];
  }
  return [];
}

function mergedForwardContext(forward: OutboxEntry): EntityRecord {
  const merged: EntityRecord = {};
  for (const [key, value] of Object.entries(forward.input)) {
    merged[key] = value;
  }
  if (forward.status !== "completed") {
    return merged;
  }
  for (const [key, value] of Object.entries(forward.output)) {
    merged[key] = value;
  }
  return merged;
}

export async function compensateRun(rt: Runtime, runId: string): Promise<number> {
  const scope = obsScope(rt);
  let dispatched = 0;
  for (const forward of compensationTargets(rt, runId)) {
    const forwardExtHits = resolveExternalByName(rt.externals, forward.name);
    if (forwardExtHits.length < 1) {
      rt.obs.error(scope, "compensation.forward_unknown", {
        runId,
        externalName: forward.name,
      });
      continue;
    }
    const forwardExt = firstPresent(forwardExtHits, "forward external required");
    if (forwardExt.compensate.length < 1) {
      rt.obs.count(scope, "compensation.skipped");
      rt.obs.info(scope, "compensation.skipped", { runId, externalName: forward.name });
      continue;
    }
    const undo = firstPresent(forwardExt.compensate, "compensation external required");
    const context = mergedForwardContext(forward);
    const undoInputHits = validatedUndoInput(undo, context);
    if (undoInputHits.length < 1) {
      rt.obs.count(scope, "compensation.input_invalid");
      rt.obs.error(scope, "compensation.input_invalid", {
        runId,
        externalName: undo.name,
        forwardExternalId: forward.externalId,
      });
      continue;
    }
    const undoInput = firstPresent(undoInputHits, "compensation input required");
    const undoId = compensationStepId(forward.externalId, undo.name);
    if (mapLookup(rt.outbox, undoId).length > 0) {
      continue;
    }
    const pending = outboxPendingEntry(
      {
        externalId: undoId,
        name: undo.name,
        input: undoInput,
        entityId: forward.entityId,
        model: forward.model,
        runId,
        attempt: 1,
      },
      {
        stepIndex: forward.stepIndex,
        undoable: false,
        nextAttemptAt: [new Date(Date.now()).toISOString()],
        error: [],
        compensationOf: [forward.externalId],
        dispatchedAt: [new Date(Date.now()).toISOString()],
      },
    );
    rt.outbox.set(undoId, pending);
    const saved = await rt.store.saveOutboxEntry(pending);
    if (saved === false) {
      rt.outbox.delete(undoId);
      logDatabaseFailure(rt);
      return dispatched;
    }
    rt.obs.count(scope, "compensation.dispatched");
    rt.obs.info(scope, "compensation.dispatched", {
      runId,
      externalName: undo.name,
      forwardExternalId: forward.externalId,
    });
    rt.pendingExternalEvents.events = appendItem(rt.pendingExternalEvents.events, {
      externalId: undoId,
      name: undo.name,
      input: undoInput,
    });
    dispatched += 1;
    return dispatched;
  }
  return dispatched;
}
