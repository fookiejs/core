import { z } from "zod";
import { ModelFieldError } from "../errors.ts";
import { isRelationField } from "../model.ts";
import type { FieldValue } from "../model.ts";

export const outboxTableName = "public.fookie_outbox";

export const runTableName = "public.fookie_run";

export function toSnakeCase(key: string): string {
  if (z.string().min(1).safeParse(key).success === false) {
    throw ModelFieldError.create("key required for snake_case");
  }
  const snake = key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  if (snake.length < 1) {
    throw ModelFieldError.create("snake_case conversion failed");
  }
  return snake;
}

export function toCamelCase(key: string): string {
  if (z.string().min(1).safeParse(key).success === false) {
    throw ModelFieldError.create("camelCase key required");
  }
  return key.replace(/_([a-z])/g, (whole, letter: string) => {
    const letterParsed = z.string().min(1).safeParse(letter);
    if (letterParsed.success === false) {
      return whole;
    }
    if (letterParsed.data.length < 1) {
      return whole;
    }
    return letterParsed.data.toUpperCase();
  });
}

export function tableNameFor(modelName: string): string {
  if (z.string().min(1).safeParse(modelName).success === false) {
    throw ModelFieldError.create("model name required for table name");
  }
  const table = toSnakeCase(modelName);
  if (z.string().min(1).safeParse(table).success === false) {
    throw ModelFieldError.create("table name required");
  }
  return table;
}

export function columnNameFor(fieldKey: string): string {
  if (z.string().min(1).safeParse(fieldKey).success === false) {
    throw ModelFieldError.create("field key required for column name");
  }
  const column = toSnakeCase(fieldKey);
  if (z.string().min(1).safeParse(column).success === false) {
    throw ModelFieldError.create("column name required");
  }
  return column;
}

export const maxIdentifierLength = 63;

export function quoteIdent(name: string): string {
  const parsed = z
    .string()
    .min(1)
    .regex(/^[a-z_][a-z0-9_]*$/)
    .safeParse(name);
  if (parsed.success === false) {
    throw ModelFieldError.create("identifier must be lower snake case");
  }
  if (parsed.data.length > maxIdentifierLength) {
    throw ModelFieldError.create("identifier is longer than postgres allows");
  }
  return `"${parsed.data}"`;
}

export function quotedTableFor(modelName: string): string {
  const bare = tableNameFor(modelName);
  const table = quoteIdent(bare);
  if (table.length < 3) {
    throw ModelFieldError.create("quoted table name required");
  }
  if (table.includes(bare) === false) {
    throw ModelFieldError.create("quoting must preserve the table name");
  }
  return `public.${table}`;
}

export function quotedColumnFor(fieldKey: string): string {
  const bare = columnNameFor(fieldKey);
  const column = quoteIdent(bare);
  if (column.length < 3) {
    throw ModelFieldError.create("quoted column name required");
  }
  if (column.includes(bare) === false) {
    throw ModelFieldError.create("quoting must preserve the column name");
  }
  return column;
}

export function relationTargetOf(field: FieldValue): readonly string[] {
  if (isRelationField(field)) {
    const refName = z.string().min(1).safeParse(field.name);
    if (refName.success === false) {
      return [];
    }
    return [refName.data];
  }
  const declared = z.string().min(1).safeParse(field.kind);
  if (declared.success === false) {
    return [];
  }
  if (declared.data.startsWith("relation:") === false) {
    return [];
  }
  const target = declared.data.slice("relation:".length);
  if (target.length < 1) {
    return [];
  }
  return [target];
}

export function pgColumnType(field: FieldValue): string {
  if (isRelationField(field)) {
    return "UUID";
  }
  const group = field.filterGroup;
  const kind = field.kind;
  if (group === "numeric") {
    if (kind === "smallint") {
      return "SMALLINT";
    }
    if (kind === "integer" || kind === "int" || kind === "serial") {
      return "INTEGER";
    }
    if (kind === "currency" || kind === "money") {
      return "NUMERIC";
    }
    if (kind === "doublePrecision") {
      return "DOUBLE PRECISION";
    }
    return "REAL";
  }
  if (group === "bigint" || group === "decimal") {
    return "NUMERIC";
  }
  if (group === "boolean") {
    return "BOOLEAN";
  }
  if (group === "uuid") {
    return "UUID";
  }
  if (group === "temporal") {
    if (kind === "date") {
      return "DATE";
    }
    if (kind === "time") {
      return "TIME";
    }
    if (kind === "timetz") {
      return "TIMETZ";
    }
    if (kind === "timestamp" || kind === "datetime") {
      return "TIMESTAMP";
    }
    if (kind === "interval") {
      return "INTERVAL";
    }
    return "TIMESTAMPTZ";
  }
  if (group === "coordinate") {
    return "POINT";
  }
  if (group === "json") {
    if (kind === "json") {
      return "JSON";
    }
    return "JSONB";
  }
  if (group === "binary") {
    return "BYTEA";
  }
  if (group === "geometric") {
    if (kind === "line") {
      return "LINE";
    }
    if (kind === "lseg") {
      return "LSEG";
    }
    if (kind === "box") {
      return "BOX";
    }
    if (kind === "path") {
      return "PATH";
    }
    if (kind === "polygon") {
      return "POLYGON";
    }
    if (kind === "circle") {
      return "CIRCLE";
    }
  }
  if (kind === "inet") {
    return "INET";
  }
  if (kind === "cidr") {
    return "CIDR";
  }
  if (kind === "macaddr") {
    return "MACADDR";
  }
  if (kind === "xml") {
    return "XML";
  }
  if (kind.startsWith("varchar(") === true && kind.endsWith(")") === true) {
    const length = kind.slice(8, -1);
    if (/^[1-9]\d*$/.test(length) === true) {
      return `VARCHAR(${length})`;
    }
  }
  if (kind.startsWith("char(") === true && kind.endsWith(")") === true) {
    const length = kind.slice(5, -1);
    if (/^[1-9]\d*$/.test(length) === true) {
      return `CHAR(${length})`;
    }
  }
  return "TEXT";
}
