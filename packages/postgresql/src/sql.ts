import { z } from "zod";
import { DatabaseError, ModelFieldError } from "@fookiejs/core";
import type { ListPage } from "@fookiejs/core";
import type { ModelDef, ModelFieldsInput } from "@fookiejs/core";
import { quotedColumnFor, toCamelCase } from "@fookiejs/core";
import type { PgParam } from "@fookiejs/core";
import { fieldGroupFor, parsePgValue } from "@fookiejs/core";
import { appendItem, firstFilterGroup } from "@fookiejs/core";
import { entityValueAt } from "@fookiejs/core";
import type { EntityRecord } from "@fookiejs/core";
import type { LockMode } from "@fookiejs/core";

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

export { pageBound } from "@fookiejs/core";
export type { OutboxQuery, RunQuery, StoreDbErrorHandler } from "@fookiejs/core";
