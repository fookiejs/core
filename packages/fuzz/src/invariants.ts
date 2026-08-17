import { z } from "zod";
import { appendItem } from "@fookiejs/core";
import type { ModelSummary, OutboxEntry, RunStateRow } from "@fookiejs/core";
import { FuzzError } from "./errors.ts";

export type Finding = {
  invariant: string;
  detail: string;
  runId: readonly string[];
};

export type WorldState = {
  models: readonly ModelSummary[];
  runs: readonly RunStateRow[];
  outbox: readonly OutboxEntry[];
};

export const settledPhases: readonly string[] = ["completed", "compensated"];

export const emptyDetail = "";

export const deadLetterStatus = "dead_letter";

export const completedPhase = "completed";

export function noRunIsBothDoneAndUndone(world: WorldState): readonly Finding[] {
  let found: readonly Finding[] = [];
  for (const run of world.runs) {
    if (String(run.phase) !== completedPhase) {
      continue;
    }
    let undone = 0;
    for (const row of world.outbox) {
      if (row.runId !== run.runId) {
        continue;
      }
      if (Array.isArray(row.compensationOf) === false) {
        continue;
      }
      if (row.compensationOf.length < 1) {
        continue;
      }
      undone = undone + 1;
    }
    if (undone < 1) {
      continue;
    }
    found = appendItem(found, {
      invariant: "completed runs are never compensated",
      detail: `run finished as completed yet carries ${String(undone)} compensation rows`,
      runId: [run.runId],
    });
  }
  return found;
}

export function everyDeadLetterSaysWhy(world: WorldState): readonly Finding[] {
  let found: readonly Finding[] = [];
  for (const row of world.outbox) {
    if (String(row.status) !== deadLetterStatus) {
      continue;
    }
    const reason = z.string().min(1).safeParse(row.error[0]);
    if (reason.success === true) {
      continue;
    }
    found = appendItem(found, {
      invariant: "a dead letter states its reason",
      detail: `${row.name} was dead lettered with no reason recorded`,
      runId: [row.runId],
    });
  }
  return found;
}

export function everyOutboxRowBelongsToARun(world: WorldState): readonly Finding[] {
  let known: readonly string[] = [];
  for (const run of world.runs) {
    known = appendItem(known, run.runId);
  }
  if (known.length < 1) {
    return [];
  }
  let found: readonly Finding[] = [];
  for (const row of world.outbox) {
    if (String(row.status) === "completed") {
      continue;
    }
    if (known.includes(row.runId)) {
      continue;
    }
    found = appendItem(found, {
      invariant: "an unsettled external belongs to a run",
      detail: `${row.name} is ${String(row.status)} but its run is gone`,
      runId: [row.runId],
    });
  }
  return found;
}

export function attemptsStayWithinBudget(world: WorldState, budget: number): readonly Finding[] {
  if (Number.isInteger(budget) === false) {
    throw FuzzError.create("an attempt budget must be a whole number");
  }
  if (budget < 1) {
    throw FuzzError.create("an attempt budget must be positive");
  }
  let found: readonly Finding[] = [];
  for (const row of world.outbox) {
    if (row.attempt <= budget) {
      continue;
    }
    found = appendItem(found, {
      invariant: "an external stops at its attempt budget",
      detail: `${row.name} reached attempt ${String(row.attempt)} past a budget of ${String(budget)}`,
      runId: [row.runId],
    });
  }
  return found;
}

export const maxReasonableAttempts = 32;

export function checkWorld(world: WorldState): readonly Finding[] {
  if (Array.isArray(world.runs) === false) {
    throw FuzzError.create("a world needs its runs to be checked");
  }
  if (Array.isArray(world.outbox) === false) {
    throw FuzzError.create("a world needs its outbox to be checked");
  }
  let all: readonly Finding[] = [];
  const suites = [
    noRunIsBothDoneAndUndone(world),
    everyDeadLetterSaysWhy(world),
    everyOutboxRowBelongsToARun(world),
    attemptsStayWithinBudget(world, maxReasonableAttempts),
  ];
  for (const suite of suites) {
    for (const finding of suite) {
      all = appendItem(all, finding);
    }
  }
  return all;
}
