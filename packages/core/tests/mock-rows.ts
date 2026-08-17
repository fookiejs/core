import { AbsentText, outboxColumns, runColumns } from "../../postgresql/src/rows.ts";

export type Cell =
  | string
  | number
  | boolean
  | null
  | readonly Cell[]
  | { readonly [column: string]: Cell };

export type Row = { [column: string]: Cell };

function splitList(listed: string): readonly string[] {
  const parts = listed.split(",");
  const columns: string[] = [];
  for (const part of parts) {
    const name = part.trim();
    if (name.length < 1) {
      throw new Error("column list required");
    }
    columns.push(name);
  }
  return columns;
}

export const outboxInsertBoundOutput = splitList(outboxColumns);

export const outboxInsertUnboundOutput = outboxInsertBoundOutput.filter(
  (column) => column !== "output",
);

export const runInsertColumns = splitList(runColumns).filter((column) => column !== "updated_at");


function isCell(raw: unknown): raw is Cell {
  if (raw === null) {
    return true;
  }
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return true;
  }
  if (Array.isArray(raw)) {
    return raw.every(isCell);
  }
  if (typeof raw === "object") {
    return Object.values(raw).every(isCell);
  }
  return false;
}

function requireParam(params: readonly unknown[], index: number, column: string): unknown {
  if (index < 0 || index >= params.length) {
    throw new Error(`missing param for ${column}`);
  }
  return params[index];
}

function zipColumns(
  columns: readonly string[],
  params: readonly unknown[],
): { readonly [column: string]: unknown } {
  if (params.length !== columns.length) {
    throw new Error(`expected ${columns.length} params, got ${params.length}`);
  }
  const zipped: { [column: string]: unknown } = {};
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index];
    if (column === undefined) {
      throw new Error("column required");
    }
    zipped[column] = requireParam(params, index, column);
  }
  return zipped;
}

function requiredText(raw: unknown, column: string): string {
  if (typeof raw !== "string") {
    throw new Error(`${column} must be text`);
  }
  if (raw === AbsentText) {
    throw new Error(`${column} cannot be absent`);
  }
  return raw;
}

function optionalText(raw: unknown, column: string): string | null {
  if (raw === null || raw === AbsentText) {
    return null;
  }
  if (typeof raw !== "string") {
    throw new Error(`${column} must be text`);
  }
  return raw;
}

function jsonCell(raw: unknown, column: string): Cell {
  if (typeof raw !== "string") {
    throw new Error(`${column} must be json text`);
  }
  const parsed: unknown = JSON.parse(raw);
  if (isCell(parsed) === false) {
    throw new Error(`${column} json is not a cell`);
  }
  return parsed;
}

function intCell(raw: unknown, column: string): number {
  if (typeof raw !== "number" || Number.isInteger(raw) === false) {
    throw new Error(`${column} must be an integer`);
  }
  return raw;
}

function entityCell(raw: unknown, column: string): Cell {
  if (raw === undefined) {
    throw new Error(`missing param for ${column}`);
  }
  if (isCell(raw) === false) {
    throw new Error(`${column} is not a cell`);
  }
  return raw;
}

export function runRowFromParams(params: readonly unknown[]): Row {
  const named = zipColumns(runInsertColumns, params);
  return {
    run_id: requiredText(named.run_id, "run_id"),
    model: requiredText(named.model, "model"),
    entity_id: requiredText(named.entity_id, "entity_id"),
    operation: requiredText(named.operation, "operation"),
    body: jsonCell(named.body, "body"),
    filter: requiredText(named.filter, "filter"),
    saga_phase: requiredText(named.saga_phase, "saga_phase"),
    pivot_external_id: optionalText(named.pivot_external_id, "pivot_external_id"),
    error: optionalText(named.error, "error"),
  };
}

export function outboxRowFromParams(params: readonly unknown[], outputBound: boolean): Row {
  if (outputBound) {
    const named = zipColumns(outboxInsertBoundOutput, params);
    return {
      external_id: requiredText(named.external_id, "external_id"),
      name: requiredText(named.name, "name"),
      status: requiredText(named.status, "status"),
      input: jsonCell(named.input, "input"),
      output: jsonCell(named.output, "output"),
      entity_id: requiredText(named.entity_id, "entity_id"),
      model: requiredText(named.model, "model"),
      run_id: requiredText(named.run_id, "run_id"),
      attempt: intCell(named.attempt, "attempt"),
      step_index: intCell(named.step_index, "step_index"),
      step: requiredText(named.step, "step"),
      next_attempt_at: optionalText(named.next_attempt_at, "next_attempt_at"),
      error: optionalText(named.error, "error"),
      compensation_of: optionalText(named.compensation_of, "compensation_of"),
      dispatched_at: optionalText(named.dispatched_at, "dispatched_at"),
    };
  }
  const named = zipColumns(outboxInsertUnboundOutput, params);
  return {
    external_id: requiredText(named.external_id, "external_id"),
    name: requiredText(named.name, "name"),
    status: requiredText(named.status, "status"),
    input: jsonCell(named.input, "input"),
    output: null,
    entity_id: requiredText(named.entity_id, "entity_id"),
    model: requiredText(named.model, "model"),
    run_id: requiredText(named.run_id, "run_id"),
    attempt: intCell(named.attempt, "attempt"),
    step_index: intCell(named.step_index, "step_index"),
    step: requiredText(named.step, "step"),
    next_attempt_at: optionalText(named.next_attempt_at, "next_attempt_at"),
    error: optionalText(named.error, "error"),
    compensation_of: optionalText(named.compensation_of, "compensation_of"),
    dispatched_at: optionalText(named.dispatched_at, "dispatched_at"),
  };
}

export function entityRowFromParams(columns: readonly string[], params: readonly unknown[]): Row {
  const named = zipColumns(columns, params);
  const row: Row = {};
  for (const column of columns) {
    row[column] = entityCell(named[column], column);
  }
  return row;
}

export function textParam(params: readonly unknown[], index: number, column: string): string {
  return requiredText(requireParam(params, index, column), column);
}
