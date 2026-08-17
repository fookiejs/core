import { z } from "zod";
import { appendItem } from "@fookiejs/core";
import type { ModelSummary, OutboxEntry, RunStateRow } from "@fookiejs/core";
import { FuzzError } from "./errors.ts";
import { checkWorld } from "./invariants.ts";
import type { Finding, WorldState } from "./invariants.ts";
import { describeStep, modelFor, planFor, replayOf } from "./plan.ts";
import type { FuzzPlan, PlannedStep } from "./plan.ts";

export type CallOutcome = {
  step: string;
  signal: string;
  threw: readonly string[];
};

export type FuzzTarget = {
  catalog(): readonly ModelSummary[];
  models(): readonly { name: string }[];
  runList(query: {
    phase: readonly never[];
    limit: number;
    offset: number;
  }): Promise<readonly RunStateRow[]>;
  outboxList(query: {
    status: readonly never[];
    runId: readonly string[];
    limit: number;
    offset: number;
  }): Promise<readonly OutboxEntry[]>;
};

export type StepRunner = (step: PlannedStep, model: ModelSummary) => Promise<CallOutcome>;

export type FuzzReport = {
  plan: FuzzPlan;
  outcomes: readonly CallOutcome[];
  findings: readonly Finding[];
  replay: string;
};

export const worldWindow = 500;

function namesOf(models: readonly ModelSummary[]): readonly string[] {
  let names: readonly string[] = [];
  for (const model of models) {
    names = appendItem(names, model.name);
  }
  return names;
}

export async function worldOf(target: FuzzTarget): Promise<WorldState> {
  const runs = await target.runList({ phase: [], limit: worldWindow, offset: 0 });
  const outbox = await target.outboxList({
    status: [],
    runId: [],
    limit: worldWindow,
    offset: 0,
  });
  if (Array.isArray(runs) === false) {
    throw FuzzError.create("the target did not answer with runs");
  }
  if (Array.isArray(outbox) === false) {
    throw FuzzError.create("the target did not answer with an outbox");
  }
  const models = target.catalog();
  const mine = namesOf(models);
  let ours: readonly RunStateRow[] = [];
  for (const run of runs) {
    if (mine.includes(run.model) === false) {
      continue;
    }
    ours = appendItem(ours, run);
  }
  let theirs: readonly OutboxEntry[] = [];
  for (const row of outbox) {
    if (mine.includes(row.model) === false) {
      continue;
    }
    theirs = appendItem(theirs, row);
  }
  return { models, runs: ours, outbox: theirs };
}

export async function runPlan(
  target: FuzzTarget,
  plan: FuzzPlan,
  call: StepRunner,
): Promise<FuzzReport> {
  if (z.instanceof(Function).safeParse(call).success === false) {
    throw FuzzError.create("a plan needs something that can run a step");
  }
  const models = target.catalog();
  let outcomes: readonly CallOutcome[] = [];
  for (const step of plan.steps) {
    const outcome = await runStep(models, step, call);
    outcomes = appendItem(outcomes, outcome);
  }
  const world = await worldOf(target);
  const findings = checkWorld(world);
  return { plan, outcomes, findings, replay: replayOf(plan) };
}

async function runStep(
  models: readonly ModelSummary[],
  step: PlannedStep,
  call: StepRunner,
): Promise<CallOutcome> {
  try {
    const model = modelFor(models, step);
    const outcome = await call(step, model);
    if (z.string().min(1).safeParse(outcome.signal).success === false) {
      throw FuzzError.create("a step outcome must carry a signal");
    }
    return outcome;
  } catch (err) {
    const named = z.object({ message: z.string().min(1) }).safeParse(err);
    const message = named.success === true ? named.data.message : "the step threw a value";
    return { step: describeStep(step), signal: "threw", threw: [message] };
  }
}

export async function fuzz(
  target: FuzzTarget,
  seed: number,
  steps: number,
  call: StepRunner,
): Promise<FuzzReport> {
  const models = target.catalog();
  if (models.length < 1) {
    throw FuzzError.create("the target registers no models to fuzz");
  }
  const plan = planFor(models, seed, steps);
  return await runPlan(target, plan, call);
}

export function summarise(report: FuzzReport): string {
  let threw = 0;
  let done = 0;
  for (const outcome of report.outcomes) {
    if (outcome.threw.length > 0) {
      threw = threw + 1;
    }
    if (outcome.signal === "done") {
      done = done + 1;
    }
  }
  const parts = [
    `${String(report.outcomes.length)} steps`,
    `${String(done)} done`,
    `${String(threw)} threw`,
    `${String(report.findings.length)} findings`,
  ];
  return `${parts.join(", ")} — replay with ${report.replay}`;
}
