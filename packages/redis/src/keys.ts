import { z } from "zod";
import { DatabaseError } from "@fookiejs/core";
import { entityValueAt } from "@fookiejs/core";
import type { EntityRecord, EntityValue } from "@fookiejs/core";

export function entityKey(table: string, entityId: string): string {
  if (z.string().min(1).safeParse(table).success === false) {
    throw DatabaseError.create("table name required");
  }
  if (z.string().min(1).safeParse(entityId).success === false) {
    throw DatabaseError.create("entity id required");
  }
  return `e:${table}:${entityId}`;
}

export function liveKey(table: string): string {
  if (z.string().min(1).safeParse(table).success === false) {
    throw DatabaseError.create("table name required");
  }
  const key = `i:${table}`;
  if (z.string().min(1).safeParse(key).success === false) {
    throw DatabaseError.create("table name required");
  }
  return key;
}

export const planePitch = 300;

export function planeKey(table: string, col: number, row: number): string {
  if (z.string().min(1).safeParse(table).success === false) {
    throw DatabaseError.create("table name required");
  }
  if (Number.isInteger(col) === false || Number.isInteger(row) === false) {
    throw DatabaseError.create("plane cell required");
  }
  return `p:${table}:${col}:${row}`;
}

export function uniqueKey(table: string, field: string, held: string): string {
  if (z.string().min(1).safeParse(table).success === false) {
    throw DatabaseError.create("table name required");
  }
  if (z.string().min(1).safeParse(field).success === false) {
    throw DatabaseError.create("field key required");
  }
  if (z.string().min(1).safeParse(held).success === false) {
    throw DatabaseError.create("unique value required");
  }
  return `u:${table}:${field}:${held}`;
}

export function uniqueText(held: EntityValue): readonly string[] {
  const asText = z.string().min(1).safeParse(held);
  if (asText.success === true) {
    return [asText.data];
  }
  const asNum = z.number().finite().safeParse(held);
  if (asNum.success === true) {
    return [String(asNum.data)];
  }
  return [];
}

export function isDeletedEntity(entity: EntityRecord): boolean {
  const flags = entityValueAt(entity, "isDeleted");
  for (const flag of flags) {
    if (flag === true) {
      return true;
    }
  }
  return false;
}
