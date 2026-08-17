import type { Phase } from "../signal.ts";
import type { JsonObject } from "../values.ts";

export type RunStateRow = {
  runId: string;
  model: string;
  entityId: string;
  operation: string;
  body: JsonObject;
  filterJson: string;
  phase: Phase;
  pivotExternalId: readonly string[];
  error: readonly string[];
  updatedAt: readonly string[];
};

export type RunStateWrite = Omit<RunStateRow, "updatedAt">;
