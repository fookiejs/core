import { z } from "zod";
import pg from "pg";
import { DatabaseError, ModelFieldError, PgEncodeError } from "../errors.ts";
import { filterGroupOf } from "../filter/schema.ts";
import type { ModelDef, ModelFieldsInput } from "../model.ts";
import { OutboxCompleted, OutboxDeadLetter, OutboxFailed, OutboxPending } from "../signal.ts";
import type { OutboxStatus } from "../signal.ts";
import { appendItem } from "../slot.ts";
import { byteaSchema, coordinateSchema, geometricValueSchema } from "../types/pg-literals.ts";
import { isPlainRecord } from "../values.ts";
import type { CaughtFailure, Coordinate, EntityValue, FilterGroup, HostValue } from "../values.ts";

export type PgParamKinds = {
  text: string;
  number: number;
  boolean: boolean;
};

export type PgParam = PgParamKinds[keyof PgParamKinds];

export type PgRow = Record<string, PgParam>;

export const pgScalarSchema = z.union([z.string(), z.number(), z.boolean()]);

export const pgPointObjectSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .strict();

export function isCoordinate(hostValue: HostValue): hostValue is Coordinate {
  const parsed = coordinateSchema.safeParse(hostValue);
  if (parsed.success === false) {
    return false;
  }
  const x = parsed.data[0];
  const y = parsed.data[1];
  if (Number.isFinite(x) === false || Number.isFinite(y) === false) {
    return false;
  }
  return true;
}

export function coordinateText(coordinate: Coordinate): string {
  const parts = coordinateSchema.safeParse(coordinate);
  if (parts.success === false) {
    throw PgEncodeError.create("coordinate required");
  }
  const x = parts.data[0];
  const y = parts.data[1];
  if (Number.isFinite(x) === false || Number.isFinite(y) === false) {
    throw PgEncodeError.create("coordinate required");
  }
  return `(${x},${y})`;
}

export function entityValueToPg(entityValue: EntityValue, group: FilterGroup): PgParam {
  if (group === "coordinate") {
    if (isCoordinate(entityValue) === false) {
      throw PgEncodeError.create("coordinate required");
    }
    return coordinateText(entityValue);
  }
  if (group === "boolean") {
    const boolParsed = z.boolean().safeParse(entityValue);
    if (boolParsed.success === false) {
      throw PgEncodeError.create("boolean required");
    }
    return boolParsed.data;
  }
  if (group === "numeric") {
    const numberParsed = z.number().finite().safeParse(entityValue);
    if (numberParsed.success === false) {
      throw PgEncodeError.create("finite number required");
    }
    return numberParsed.data;
  }
  if (group === "json") {
    const jsonTextParsed = z.string().safeParse(entityValue);
    if (jsonTextParsed.success === false) {
      throw PgEncodeError.create("json text required");
    }
    try {
      JSON.parse(jsonTextParsed.data);
    } catch {
      throw PgEncodeError.create("json parse failed");
    }
    return jsonTextParsed.data;
  }
  const textParsed = z.string().safeParse(entityValue);
  if (textParsed.success === false) {
    throw PgEncodeError.create("string required");
  }
  if (group === "bigint") {
    if (/^-?\d+$/.test(textParsed.data) === false) {
      throw PgEncodeError.create("bigint shape required");
    }
    return textParsed.data;
  }
  if (group === "decimal") {
    if (/^-?\d+(\.\d+)?$/.test(textParsed.data) === false) {
      throw PgEncodeError.create("decimal shape required");
    }
    return textParsed.data;
  }
  if (group === "binary") {
    if (byteaSchema.safeParse(textParsed.data).success === false) {
      throw PgEncodeError.create("bytea shape required");
    }
    return textParsed.data;
  }
  if (group === "geometric") {
    if (geometricValueSchema.safeParse(textParsed.data).success === false) {
      throw PgEncodeError.create("geometric shape required");
    }
    return textParsed.data;
  }
  return textParsed.data;
}

export function parsePgValue(raw: PgParam, group: FilterGroup): EntityValue {
  const scalarParsed = z.union([z.number(), z.boolean()]).safeParse(raw);
  if (scalarParsed.success === true) {
    return scalarParsed.data;
  }
  const cellTextParsed = z.string().safeParse(raw);
  if (cellTextParsed.success === false) {
    throw PgEncodeError.create("pg cell text required");
  }
  const cellText = cellTextParsed.data;
  if (group === "coordinate") {
    for (const match of cellText.matchAll(/^\(([-\d.]+),([-\d.]+)\)$/g)) {
      let groups: readonly string[] = [];
      let index = 0;
      for (const part of match) {
        if (index === 1 || index === 2) {
          if (z.string().safeParse(part).success === true) {
            groups = appendItem(groups, part);
          }
        }
        index += 1;
      }
      if (groups.length === 2) {
        const x = Number(groups[0]);
        const y = Number(groups[1]);
        if (Number.isFinite(x) === true && Number.isFinite(y) === true) {
          const point: Coordinate = [x, y];
          return point;
        }
      }
    }
  }
  if (group === "numeric") {
    const parsed = Number(cellText);
    if (Number.isFinite(parsed) === true) {
      return parsed;
    }
  }
  if (group === "boolean") {
    if (cellText === "true" || cellText === "t") {
      return true;
    }
    if (cellText === "false" || cellText === "f") {
      return false;
    }
  }
  return cellText;
}

export function fieldGroupFor(model: ModelDef<ModelFieldsInput>, key: string): FilterGroup[] {
  if (z.looseObject({}).safeParse(model).success === false) {
    throw ModelFieldError.create("model required for field group");
  }
  if (z.string().min(1).safeParse(key).success === false) {
    throw ModelFieldError.create("field key required");
  }
  for (const [fieldKey, field] of Object.entries(model.fields)) {
    if (fieldKey === key) {
      return [filterGroupOf(field)];
    }
  }
  return [];
}

export type DbErrorBox = { message: string };

export function dbErrorMessage(err: CaughtFailure): string {
  if (err instanceof Error) {
    if (err.message.length > 0) {
      return err.message;
    }
    throw DatabaseError.create("database unavailable");
  }
  const messageParsed = z.string().safeParse(err);
  if (messageParsed.success === true) {
    if (messageParsed.data.length > 0) {
      return messageParsed.data;
    }
    throw DatabaseError.create("database unavailable");
  }
  const scalarMessageParsed = z.union([z.number(), z.boolean()]).safeParse(err);
  if (scalarMessageParsed.success === true) {
    return `${scalarMessageParsed.data}`;
  }
  throw DatabaseError.create("database unavailable");
}

export function dbErrorMessageForLog(err: CaughtFailure, fallback: string): string {
  const fallbackParsed = z.string().min(1).safeParse(fallback);
  const safeFallback =
    fallbackParsed.success === true ? fallbackParsed.data : "database unavailable";
  try {
    return dbErrorMessage(err);
  } catch {
    return safeFallback;
  }
}

export function dbErrorBoxText(errorBox: DbErrorBox): string {
  if (z.object({ message: z.string() }).safeParse(errorBox).success === false) {
    throw DatabaseError.create("database unavailable");
  }
  if (errorBox.message.length > 0) {
    return errorBox.message;
  }
  return "database unavailable";
}

export function captureDbError(err: CaughtFailure, errorBox: DbErrorBox): void {
  if (z.object({ message: z.string() }).safeParse(errorBox).success === false) {
    throw DatabaseError.create("database unavailable");
  }
  const message = dbErrorMessageForLog(err, "database unavailable");
  if (z.string().min(1).safeParse(message).success === false) {
    errorBox.message = "database unavailable";
    return;
  }
  errorBox.message = message;
}

export function pgCellRawPresent(raw: HostValue): boolean {
  if (pgScalarSchema.safeParse(raw).success === true) {
    return true;
  }
  if (raw instanceof Date) {
    if (Number.isFinite(raw.getTime()) === false) {
      return false;
    }
    return true;
  }
  if (Buffer.isBuffer(raw) === true) {
    return true;
  }
  if (Array.isArray(raw) === true) {
    return true;
  }
  return isPlainRecord(raw);
}

export function pgCellValue(raw: HostValue): PgParam {
  const scalar = pgScalarSchema.safeParse(raw);
  if (scalar.success === true) {
    return scalar.data;
  }
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime()) === true) {
      throw PgEncodeError.create("invalid date cell");
    }
    return raw.toISOString();
  }
  if (Buffer.isBuffer(raw) === true) {
    return `\\x${raw.toString("hex")}`;
  }
  const point = pgPointObjectSchema.safeParse(raw);
  if (point.success === true) {
    return `(${point.data.x},${point.data.y})`;
  }
  if (isPlainRecord(raw) === true) {
    return JSON.stringify(raw);
  }
  if (Array.isArray(raw) === true) {
    if (isCoordinate(raw) === true) {
      return coordinateText(raw);
    }
    return JSON.stringify(raw);
  }
  throw PgEncodeError.create("unsupported pg cell");
}

export function pgRowCells(row: pg.QueryResultRow): Record<string, PgParam> {
  const cells: Record<string, PgParam> = {};
  for (const [key, raw] of Object.entries(row)) {
    if (pgCellRawPresent(raw) === false) {
      continue;
    }
    cells[key] = pgCellValue(raw);
  }
  return cells;
}

export function firstQueryRow(rows: readonly pg.QueryResultRow[]): pg.QueryResultRow[] {
  if (Array.isArray(rows) === false) {
    throw DatabaseError.create("query rows required");
  }
  let found: readonly pg.QueryResultRow[] = [];
  for (const row of rows) {
    found = appendItem(found, row);
    break;
  }
  return found.slice();
}

export function pgCellToString(raw: HostValue): string {
  const cell = pgCellValue(raw);
  const asString = z.string().safeParse(cell);
  if (asString.success === false) {
    throw PgEncodeError.create("cell is not a string");
  }
  if (asString.data.length < 1) {
    throw PgEncodeError.create("cell is not a string");
  }
  return asString.data;
}

export function isOutboxStatus(statusText: string): statusText is OutboxStatus {
  if (statusText === OutboxPending) {
    return true;
  }
  if (statusText === OutboxFailed) {
    return true;
  }
  if (statusText === OutboxCompleted) {
    return true;
  }
  if (statusText === OutboxDeadLetter) {
    return true;
  }
  return false;
}
