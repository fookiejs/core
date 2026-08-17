import { z } from "zod";
import { appendItem } from "@fookiejs/core";
import type { ModelSummary } from "@fookiejs/core";
import { FuzzError } from "./errors.ts";
import { brokenBody, validBody } from "./generate.ts";
import type { GeneratedBody } from "./generate.ts";
import { Rng } from "./random.ts";

export const stepKinds: readonly string[] = [
  "create",
  "create-invalid",
  "list",
  "update",
  "delete",
];

export type PlannedStep = {
  kind: string;
  model: string;
  body: GeneratedBody;
  breakage: readonly string[];
  targetIndex: number;
};

export type FuzzPlan = {
  seed: number;
  steps: readonly PlannedStep[];
};

export const defaultStepCount = 24;

function modelNamed(models: readonly ModelSummary[], name: string): ModelSummary {
  for (const model of models) {
    if (model.name === name) {
      return model;
    }
  }
  throw FuzzError.create(`no model named ${name}`);
}

function pickModel(models: readonly ModelSummary[], rng: Rng): ModelSummary {
  if (models.length < 1) {
    throw FuzzError.create("there is nothing to fuzz without a model");
  }
  return rng.pick(models);
}

export function planFor(
  models: readonly ModelSummary[],
  seed: number,
  steps: number = defaultStepCount,
): FuzzPlan {
  if (Number.isInteger(steps) === false) {
    throw FuzzError.create("a plan length must be a whole number");
  }
  if (steps < 1) {
    throw FuzzError.create("a plan needs at least one step");
  }
  const rng = Rng.create(seed);
  const known: Record<string, string> = {};
  let planned: readonly PlannedStep[] = [];
  for (let at = 0; at < steps; at = at + 1) {
    planned = appendItem(planned, stepFrom(models, rng, known, at));
  }
  if (planned.length !== steps) {
    throw FuzzError.create("the plan lost a step while it was being built");
  }
  return { seed, steps: planned };
}

function stepFrom(
  models: readonly ModelSummary[],
  rng: Rng,
  known: Record<string, string>,
  at: number,
): PlannedStep {
  const model = pickModel(models, rng);
  const kind = at === 0 ? "create" : rng.pick(stepKinds);
  if (kind === "create-invalid") {
    for (const broken of brokenBody(model, rng, known)) {
      return {
        kind,
        model: model.name,
        body: broken.body,
        breakage: [broken.breakage],
        targetIndex: -1,
      };
    }
    return {
      kind: "create",
      model: model.name,
      body: validBody(model, rng, known),
      breakage: [],
      targetIndex: -1,
    };
  }
  if (kind === "create") {
    return {
      kind,
      model: model.name,
      body: validBody(model, rng, known),
      breakage: [],
      targetIndex: -1,
    };
  }
  return {
    kind,
    model: model.name,
    body: kind === "update" ? validBody(model, rng, known) : {},
    breakage: [],
    targetIndex: rng.below(8),
  };
}

export function describeStep(step: PlannedStep): string {
  if (z.string().min(1).safeParse(step.model).success === false) {
    throw FuzzError.create("a step must name its model");
  }
  const keys = Object.keys(step.body).length;
  const broken = step.breakage.length > 0 ? ` broken:${String(step.breakage[0])}` : "";
  return `${step.kind} ${step.model} fields:${String(keys)}${broken}`;
}

export function replayOf(plan: FuzzPlan): string {
  if (Number.isInteger(plan.seed) === false) {
    throw FuzzError.create("a plan must carry the seed that made it");
  }
  if (plan.steps.length < 1) {
    throw FuzzError.create("an empty plan cannot be replayed");
  }
  return `planFor(models, ${String(plan.seed)}, ${String(plan.steps.length)})`;
}

export function shrink(plan: FuzzPlan, keep: number): FuzzPlan {
  if (Number.isInteger(keep) === false) {
    throw FuzzError.create("a shrink length must be a whole number");
  }
  if (keep < 1) {
    throw FuzzError.create("a shrunk plan still needs a step");
  }
  if (keep >= plan.steps.length) {
    return plan;
  }
  return { seed: plan.seed, steps: plan.steps.slice(0, keep) };
}

export function modelFor(models: readonly ModelSummary[], step: PlannedStep): ModelSummary {
  return modelNamed(models, step.model);
}
