import { outboxTableName, runTableName } from "../src/pg/naming.ts";

export type StatementKinds = {
  begin: { kind: "begin" };
  commit: { kind: "commit" };
  rollback: { kind: "rollback" };
  set: { kind: "set" };
  createTable: { kind: "create-table"; table: string };
  createIndex: { kind: "create-index" };
  alterTable: { kind: "alter-table" };
  delete: { kind: "delete"; table: string; key: "id" | "run_id" };
  insertRun: { kind: "insert-run" };
  insertOutbox: { kind: "insert-outbox"; outputBound: boolean };
  insertEntity: { kind: "insert-entity"; table: string; columns: readonly string[] };
  selectRunById: { kind: "select-run-by-id" };
  selectRunList: { kind: "select-run-list"; phases: readonly string[]; paramSlots: number };
  selectOutbox: { kind: "select-outbox" };
  selectOutboxById: { kind: "select-outbox-by-id" };
  claimOutbox: { kind: "claim-outbox" };
  selectEntityById: { kind: "select-entity-by-id"; table: string };
  selectEntityList: { kind: "select-entity-list"; table: string };
  noop: { kind: "noop" };
};

export type Statement = StatementKinds[keyof StatementKinds];

const createIfNotExists = "CREATE TABLE IF NOT EXISTS ";
const insertInto = "INSERT INTO ";
const deleteFrom = "DELETE FROM ";
const selectStarFrom = "SELECT * FROM ";
const prunePhaseSql = "IN ('completed', 'compensated')";
const outboxBare = bareTable(outboxTableName);
const runBare = bareTable(runTableName);

export function unquoteIdents(sql: string): string {
  let out = "";
  let index = 0;
  while (index < sql.length) {
    const ch = sql[index];
    if (ch === '"') {
      const end = sql.indexOf('"', index + 1);
      if (end < 0) {
        throw new Error("unterminated quoted identifier");
      }
      out = out + sql.slice(index + 1, end);
      index = end + 1;
      continue;
    }
    out = out + ch;
    index = index + 1;
  }
  return out;
}

function skipSpaces(sql: string, from: number): number {
  let index = from;
  while (index < sql.length) {
    const ch = sql[index];
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") {
      index = index + 1;
      continue;
    }
    break;
  }
  return index;
}

function takeIdent(sql: string, from: number): { ident: string; next: number } {
  const start = skipSpaces(sql, from);
  let index = start;
  while (index < sql.length) {
    const ch = sql[index];
    if (ch === undefined) {
      break;
    }
    const code = ch.charCodeAt(0);
    const letter = code >= 97 && code <= 122;
    const digit = code >= 48 && code <= 57;
    if (letter === false && digit === false && ch !== "_") {
      break;
    }
    index = index + 1;
  }
  if (index === start) {
    throw new Error("identifier required");
  }
  return { ident: sql.slice(start, index), next: index };
}

function takeQualified(sql: string, from: number): { ident: string; next: number } {
  const first = takeIdent(sql, from);
  if (sql[first.next] === ".") {
    const second = takeIdent(sql, first.next + 1);
    return { ident: `${first.ident}.${second.ident}`, next: second.next };
  }
  return first;
}

export function bareTable(qualified: string): string {
  const dot = qualified.lastIndexOf(".");
  if (dot < 0) {
    return qualified;
  }
  return qualified.slice(dot + 1);
}

function splitColumns(inner: string): readonly string[] {
  const parts = inner.split(",");
  const columns: string[] = [];
  for (const part of parts) {
    const name = part.trim();
    if (name.length < 1) {
      throw new Error("insert column name required");
    }
    columns.push(name);
  }
  return columns;
}

function parseInsert(sql: string): { table: string; columns: readonly string[] } {
  if (sql.startsWith(insertInto) === false) {
    throw new Error("insert required");
  }
  const taken = takeQualified(sql, insertInto.length);
  const afterTable = skipSpaces(sql, taken.next);
  if (sql[afterTable] !== "(") {
    throw new Error("insert column list required");
  }
  const valuesAt = sql.indexOf("VALUES", afterTable);
  if (valuesAt < 0) {
    throw new Error("insert VALUES required");
  }
  const close = sql.lastIndexOf(")", valuesAt);
  if (close <= afterTable) {
    throw new Error("insert column list required");
  }
  return {
    table: bareTable(taken.ident),
    columns: splitColumns(sql.slice(afterTable + 1, close)),
  };
}

function firstFromTable(sql: string): string {
  const marker = " FROM ";
  const at = sql.indexOf(marker);
  if (at < 0) {
    throw new Error("FROM required");
  }
  const taken = takeQualified(sql, at + marker.length);
  return bareTable(taken.ident);
}

function inListPlaceholders(sql: string): number {
  const marker = " IN (";
  const at = sql.indexOf(marker);
  if (at < 0) {
    return 0;
  }
  const close = sql.indexOf(")", at);
  if (close < 0) {
    throw new Error("IN list required");
  }
  const inner = sql.slice(at + marker.length, close).trim();
  if (inner.length < 1) {
    return 0;
  }
  if (inner.startsWith("$") === false) {
    return 0;
  }
  return inner.split(",").length;
}

function classifySelect(sql: string): Statement {
  const table = firstFromTable(sql);
  if (table === outboxBare) {
    if (sql.includes("WHERE external_id = $1")) {
      return { kind: "select-outbox-by-id" };
    }
    return { kind: "select-outbox" };
  }
  if (table === runBare) {
    if (sql.includes("WHERE run_id = $1")) {
      return { kind: "select-run-by-id" };
    }
    if (sql.includes(prunePhaseSql)) {
      return { kind: "select-run-list", phases: ["completed", "compensated"], paramSlots: 0 };
    }
    return { kind: "select-run-list", phases: [], paramSlots: inListPlaceholders(sql) };
  }
  if (sql.startsWith(selectStarFrom) && sql.includes("WHERE id = $1")) {
    return { kind: "select-entity-by-id", table };
  }
  return { kind: "select-entity-list", table };
}

function classifyInsert(sql: string): Statement {
  const parsed = parseInsert(sql);
  if (parsed.table === "fookie_schema") {
    return { kind: "noop" };
  }
  if (parsed.table === runBare) {
    return { kind: "insert-run" };
  }
  if (parsed.table === outboxBare) {
    return { kind: "insert-outbox", outputBound: sql.includes("$5::jsonb") };
  }
  return { kind: "insert-entity", table: parsed.table, columns: parsed.columns };
}

function classifyDelete(sql: string): Statement {
  if (sql.startsWith(deleteFrom) === false) {
    throw new Error("delete required");
  }
  const taken = takeQualified(sql, deleteFrom.length);
  const table = bareTable(taken.ident);
  if (table === outboxBare || table === runBare) {
    return { kind: "delete", table, key: "run_id" };
  }
  return { kind: "delete", table, key: "id" };
}

function classifyCreateTable(sql: string): Statement {
  const start = sql.startsWith(createIfNotExists)
    ? createIfNotExists.length
    : "CREATE TABLE ".length;
  const taken = takeQualified(sql, start);
  return { kind: "create-table", table: bareTable(taken.ident) };
}

export function classify(sql: string): Statement {
  if (sql.startsWith("BEGIN")) {
    return { kind: "begin" };
  }
  if (sql === "COMMIT") {
    return { kind: "commit" };
  }
  if (sql === "ROLLBACK") {
    return { kind: "rollback" };
  }
  if (sql.startsWith("SET ")) {
    return { kind: "set" };
  }
  if (sql.startsWith("CREATE TABLE")) {
    return classifyCreateTable(sql);
  }
  if (sql.startsWith("CREATE UNIQUE INDEX") || sql.startsWith("CREATE INDEX")) {
    return { kind: "create-index" };
  }
  if (sql.startsWith("ALTER TABLE")) {
    return { kind: "alter-table" };
  }
  if (sql.startsWith(deleteFrom)) {
    return classifyDelete(sql);
  }
  if (sql.startsWith(insertInto)) {
    return classifyInsert(sql);
  }
  if (
    sql.startsWith("UPDATE ") &&
    sql.includes(outboxBare) &&
    sql.includes("FOR UPDATE SKIP LOCKED")
  ) {
    return { kind: "claim-outbox" };
  }
  if (sql.startsWith("SELECT pg_notify(")) {
    return { kind: "noop" };
  }
  if (sql.startsWith("SELECT")) {
    return classifySelect(sql);
  }
  return { kind: "noop" };
}
