import { Done } from "@fookiejs/core";
import type { ModelSummary } from "@fookiejs/core";
import { fuzz, seedFrom, summarise } from "@fookiejs/fuzz";
import type { CallOutcome, PlannedStep } from "@fookiejs/fuzz";
import { bead, createFookie } from "./model.ts";

const fookie = createFookie();
fookie.run();

const serving = await fookie.ready();
if (serving === false) {
  console.error("postgres or redis is not reachable; check DATABASE_URL and REDIS_URL");
  process.exit(1);
}

const madeIds: string[] = [];

const runStep = async (step: PlannedStep, model: ModelSummary): Promise<CallOutcome> => {
  const described = `${step.kind} ${model.name}`;
  if (step.kind === "create" || step.kind === "create-invalid") {
    const outcome = await fookie.create(bead, step.body as never);
    if (outcome.signal === Done) {
      madeIds.push(outcome.id);
    }
    return { step: described, signal: outcome.signal, threw: [] };
  }
  if (step.kind === "list") {
    const outcome = await fookie.list(bead, {});
    return { step: described, signal: outcome.signal, threw: [] };
  }
  if (madeIds.length < 1) {
    return { step: described, signal: "skipped", threw: [] };
  }
  const id = madeIds[step.targetIndex % madeIds.length];
  if (id === undefined) {
    return { step: described, signal: "skipped", threw: [] };
  }
  if (step.kind === "update") {
    const outcome = await fookie.update(bead, { id: { eq: id } }, step.body as never);
    return { step: described, signal: outcome.signal, threw: [] };
  }
  const outcome = await fookie.delete(bead, { id, filter: {} });
  return { step: described, signal: outcome.signal, threw: [] };
};

const report = await fuzz(fookie, seedFrom("fookie-demo"), 24, runStep);
console.log(summarise(report));
if (report.findings.length > 0) {
  process.exitCode = 1;
}

await fookie.stop();
