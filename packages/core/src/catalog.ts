import { z } from "zod";
import { ValidationError } from "./errors.ts";
import type { ExternalDef } from "./external.ts";
import { isRelationField, isSystemFieldKey } from "./model.ts";
import type { FieldValue, ModelDef, ModelFieldsInput } from "./model.ts";
import { columnNameFor, pgColumnType, relationTargetOf, tableNameFor } from "./pg/naming.ts";
import { appendItem } from "./slot.ts";

export type FieldSummary = {
  key: string;
  column: string;
  pgType: string;
  relation: readonly string[];
  unique: boolean;
  index: boolean;
  system: boolean;
};

export type ModelSummary = {
  name: string;
  table: string;
  fields: readonly FieldSummary[];
};

export type ExternalSummary = {
  name: string;
  attempts: number;
  backoff: string;
  timeoutMs: number;
  inputKeys: readonly string[];
  outputKeys: readonly string[];
  compensate: readonly string[];
};

function fieldSummaryOf(key: string, field: FieldValue): FieldSummary {
  if (z.string().min(1).safeParse(key).success === false) {
    throw ValidationError.create("catalog field key required");
  }
  const relation = relationTargetOf(field);
  if (isRelationField(field)) {
    return {
      key,
      column: columnNameFor(key),
      pgType: pgColumnType(field),
      relation,
      unique: false,
      index: true,
      system: isSystemFieldKey(key),
    };
  }
  return {
    key,
    column: columnNameFor(key),
    pgType: pgColumnType(field),
    relation,
    unique: field.meta.unique,
    index: field.meta.index,
    system: isSystemFieldKey(key),
  };
}

export function modelSummaryOf(model: ModelDef<ModelFieldsInput>): ModelSummary {
  if (z.string().min(1).safeParse(model.name).success === false) {
    throw ValidationError.create("catalog model name required");
  }
  let fields: readonly FieldSummary[] = [];
  for (const [key, field] of Object.entries(model.fields)) {
    fields = appendItem(fields, fieldSummaryOf(key, field));
  }
  return { name: model.name, table: tableNameFor(model.name), fields };
}

export function externalSummaryOf(external: ExternalDef): ExternalSummary {
  if (z.string().min(1).safeParse(external.name).success === false) {
    throw ValidationError.create("catalog external name required");
  }
  let compensate: readonly string[] = [];
  for (const undo of external.compensate) {
    compensate = appendItem(compensate, undo.name);
  }
  return {
    name: external.name,
    attempts: external.attempts,
    backoff: external.backoff,
    timeoutMs: external.timeoutMs,
    inputKeys: Object.keys(external.input),
    outputKeys: Object.keys(external.output),
    compensate,
  };
}
