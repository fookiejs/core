import { z } from "zod";
import { DatabaseError, ModelFieldError } from "../errors.ts";
import type { ListPage } from "../filter/ops.ts";
import type { ModelDef, ModelFieldsInput } from "../model.ts";
import { quotedColumnFor, toCamelCase } from "./naming.ts";
import type { PgParam } from "./encode.ts";
import { fieldGroupFor, parsePgValue } from "./encode.ts";
import { appendItem, firstFilterGroup } from "../slot.ts";
import { entityValueAt } from "../values.ts";
import type { EntityRecord } from "../values.ts";
import type { OutboxStatus, Phase } from "../signal.ts";

export function rowToEntity(
  model: ModelDef<ModelFieldsInput>,
  row: Record<string, PgParam>,
): EntityRecord {
  const entity: EntityRecord = {};
  for (const [col, raw] of Object.entries(row)) {
    const key = toCamelCase(col);
    const groups = fieldGroupFor(model, key);
    if (groups.length < 1) {
      continue;
    }
    entity[key] = parsePgValue(raw, firstFilterGroup(groups));
  }
  const ids = entityValueAt(entity, "id");
  if (ids.length < 1) {
    throw DatabaseError.create("entity row invalid");
  }
  for (const id of ids) {
    if (z.string().safeParse(id).success === false) {
      throw DatabaseError.create("entity row invalid");
    }
  }
  return entity;
}

type PageSql = {
  sql: string;
  params: readonly PgParam[];
};

export function pageSqlFor(
  model: ModelDef<ModelFieldsInput>,
  page: ListPage,
  startIndex: number,
): PageSql {
  let clauses: readonly string[] = [];
  for (const term of page.order) {
    if (Object.keys(model.fields).includes(term.field) === false) {
      throw ModelFieldError.create("order field unknown");
    }
    const direction = term.direction === "desc" ? "DESC" : "ASC";
    clauses = appendItem(clauses, `${quotedColumnFor(term.field)} ${direction}`);
  }
  clauses = appendItem(clauses, "id ASC");
  let tail = ` ORDER BY ${clauses.join(", ")}`;
  let params: readonly PgParam[] = [];
  let index = startIndex;
  for (const limit of page.limit) {
    if (Number.isInteger(limit) === false || limit < 0) {
      throw ModelFieldError.create("list limit must be a non-negative integer");
    }
    tail = `${tail} LIMIT $${index}`;
    params = appendItem(params, limit);
    index += 1;
  }
  for (const offset of page.offset) {
    if (Number.isInteger(offset) === false || offset < 0) {
      throw ModelFieldError.create("list offset must be a non-negative integer");
    }
    tail = `${tail} OFFSET $${index}`;
    params = appendItem(params, offset);
    index += 1;
  }
  return { sql: tail, params };
}

export type LockModeKinds = {
  write: "write";
};

export type LockMode = LockModeKinds[keyof LockModeKinds];

const noLockSql = " ";

export function lockSqlFor(lock: readonly LockMode[]): string {
  for (const mode of lock) {
    if (mode !== "write") {
      throw ModelFieldError.create("unknown lock mode");
    }
    return " FOR NO KEY UPDATE";
  }
  return noLockSql.trimEnd();
}

export type RunQuery = {
  phase: readonly Phase[];
  limit: number;
  offset: number;
};

export type OutboxQuery = {
  status: readonly OutboxStatus[];
  runId: readonly string[];
  limit: number;
  offset: number;
};

type BoundList = {
  sql: string;
  params: readonly PgParam[];
};

export function boundInList(
  column: string,
  values: readonly string[],
  startIndex: number,
): BoundList {
  if (values.length === 0) {
    return { sql: "TRUE", params: [] };
  }
  let slots: readonly string[] = [];
  let params: readonly PgParam[] = [];
  let index = startIndex;
  for (const listed of values) {
    slots = appendItem(slots, `$${index}`);
    params = appendItem(params, listed);
    index += 1;
  }
  return { sql: `${column} IN (${slots.join(", ")})`, params };
}

export function pageBound(bound: number): number {
  if (Number.isInteger(bound) === false) {
    throw ModelFieldError.create("listing bound must be an integer");
  }
  if (bound < 0) {
    throw ModelFieldError.create("listing bound must not be negative");
  }
  return bound;
}

export type StoreDbErrorHandler = (message: string) => void;
