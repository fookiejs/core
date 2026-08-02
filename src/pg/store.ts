import { z } from "zod";
import { logDatabaseFailure } from "../engine/flow.ts";
import type { OutboxEntry } from "../engine/outbox.ts";
import type { Runtime } from "../engine/runtime.ts";
import { DatabaseError, ModelFieldError, NotFoundError, PgEncodeError } from "../errors.ts";
import { emptyListPage } from "../filter/ops.ts";
import type { FilterState, ListPage } from "../filter/ops.ts";
import { entityStoreKey, isRelationField, isSystemFieldKey } from "../model.ts";
import type { ModelDef, ModelFieldsInput } from "../model.ts";
import {
  captureDbError,
  sqlStateOf,
  dbErrorMessageForLog,
  fieldGroupFor,
  firstQueryRow,
  parsePgValue,
  pgRowCells,
} from "./encode.ts";
import type { DbErrorBox, PgParam, PgRow } from "./encode.ts";
import {
  columnNameFor,
  outboxTableName,
  pgColumnType,
  quoteIdent,
  quotedColumnFor,
  quotedTableFor,
  relationTargetOf,
  runTableName,
  tableNameFor,
  toCamelCase,
} from "./naming.ts";
import type { OutboxStatus, Phase } from "../signal.ts";
import type { PgQueryResult, PgQueryable } from "./pool.ts";
import {
  firstTextOrAbsent,
  outboxColumns,
  outboxEntryFromRow,
  runColumns,
  runStateFromRow,
} from "./rows.ts";
import type { RunStateRow, RunStateWrite } from "./rows.ts";
import { UpsertSql } from "./upsert.ts";
import { WhereSql } from "./where.ts";
import { appendItem, firstFilterGroup, mapLookup } from "../slot.ts";
import { entityValueAt } from "../values.ts";
import type { CaughtFailure, EntityRecord } from "../values.ts";

export type { RunStateRow } from "./rows.ts";

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

export class PostgresStore {
  private readonly db: PgQueryable;
  private readonly onDbError: readonly StoreDbErrorHandler[];
  private readonly stateBox: { codes: readonly string[] } = { codes: [] };

  private constructor(db: PgQueryable, onDbError: readonly StoreDbErrorHandler[]) {
    if (z.function().safeParse(db.query).success === false) {
      throw DatabaseError.create("database client required");
    }
    if (Array.isArray(onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    this.db = { query: (sql, params = []) => this.noteFailures(db, sql, params) };
    this.onDbError = onDbError;
  }

  private async noteFailures(
    db: PgQueryable,
    sql: string,
    params: readonly PgParam[],
  ): Promise<PgQueryResult> {
    try {
      return await db.query(sql, params.slice());
    } catch (err) {
      const codes = sqlStateOf(err);
      if (codes.length > 0) {
        this.stateBox.codes = codes;
      }
      throw err;
    }
  }

  lastSqlState(): readonly string[] {
    if (Array.isArray(this.stateBox.codes) === false) {
      throw DatabaseError.create("sql state box required");
    }
    if (this.stateBox.codes.length > 1) {
      throw DatabaseError.create("only the last sql state is kept");
    }
    return this.stateBox.codes;
  }

  static create(db: PgQueryable, onDbError: readonly StoreDbErrorHandler[] = []): PostgresStore {
    if (z.function().safeParse(db.query).success === false) {
      throw DatabaseError.create("database client required");
    }
    if (Array.isArray(onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    return new PostgresStore(db, onDbError);
  }

  withClient(client: PgQueryable): PostgresStore {
    if (z.function().safeParse(client.query).success === false) {
      throw DatabaseError.create("database client required");
    }
    if (Array.isArray(this.onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    return PostgresStore.create(client, this.onDbError);
  }

  private failQuery(err: CaughtFailure): false {
    const message = dbErrorMessageForLog(err, "database unavailable");
    if (z.string().min(1).safeParse(message).success === false) {
      return false;
    }
    for (const reportDbError of this.onDbError) {
      reportDbError(message);
      break;
    }
    return false;
  }

  async selectRows(sql: string, params: readonly PgParam[]): Promise<readonly PgRow[]> {
    if (z.string().min(1).safeParse(sql).success === false) {
      throw DatabaseError.create("query sql required");
    }
    if (Array.isArray(params) === false) {
      throw DatabaseError.create("query params required");
    }
    try {
      const queryResult = await this.db.query(sql, params.slice());
      let rows: readonly PgRow[] = [];
      for (const row of queryResult.rows) {
        rows = appendItem(rows, pgRowCells(row));
      }
      return rows;
    } catch (err) {
      throw DatabaseError.create(dbErrorMessageForLog(err, "query failed"));
    }
  }

  async ensureAllTables(
    models: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    errorBox: DbErrorBox,
  ): Promise<boolean> {
    for (const model of models) {
      const ok = await this.ensureModelTable(model, errorBox);
      if (ok === false) {
        return false;
      }
    }
    for (const model of models) {
      const linked = await this.ensureModelForeignKeys(model, errorBox);
      if (linked === false) {
        return false;
      }
    }
    return this.ensureOutboxTable(errorBox);
  }

  private async ensureModelTable(
    model: ModelDef<ModelFieldsInput>,
    errorBox: DbErrorBox,
  ): Promise<boolean> {
    const table = tableNameFor(model.name);
    const qualified = quotedTableFor(model.name);
    let columns: readonly string[] = [];
    for (const [key, field] of Object.entries(model.fields)) {
      const col = quotedColumnFor(key);
      const type = pgColumnType(field);
      if (key === "isDeleted") {
        columns = appendItem(columns, `${col} ${type} NOT NULL DEFAULT false`);
      } else if (key === "createdAt" || key === "updatedAt") {
        columns = appendItem(columns, `${col} ${type} NOT NULL DEFAULT NOW()`);
      } else if (isSystemFieldKey(key)) {
        columns = appendItem(columns, `${col} ${type} NOT NULL`);
      } else {
        columns = appendItem(columns, `${col} ${type}`);
      }
    }
    const sql = `CREATE TABLE IF NOT EXISTS ${qualified} (${columns.join(", ")}, PRIMARY KEY (id))`;
    try {
      await this.db.query(sql);
      for (const [alterKey, alterField] of Object.entries(model.fields)) {
        const col = quotedColumnFor(alterKey);
        const indexName = quoteIdent(`${table}_${columnNameFor(alterKey)}_idx`);
        const uniqueName = quoteIdent(`${table}_${columnNameFor(alterKey)}_uidx`);
        const type = pgColumnType(alterField);
        let alterSql = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS ${col} ${type}`;
        if (alterKey === "isDeleted") {
          alterSql = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS ${col} ${type} NOT NULL DEFAULT false`;
        } else if (alterKey === "createdAt" || alterKey === "updatedAt") {
          alterSql = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS ${col} ${type} NOT NULL DEFAULT NOW()`;
        }
        await this.db.query(alterSql);
        if (isRelationField(alterField)) {
          await this.db.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${qualified} (${col})`);
          continue;
        }
        if (alterField.meta.unique) {
          await this.db.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS ${uniqueName} ON ${qualified} (${col})`,
          );
        }
        if (alterField.meta.index && alterField.meta.unique === false) {
          await this.db.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${qualified} (${col})`);
        }
      }
      return true;
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }

  private async ensureModelForeignKeys(
    model: ModelDef<ModelFieldsInput>,
    errorBox: DbErrorBox,
  ): Promise<boolean> {
    const table = tableNameFor(model.name);
    const qualified = quotedTableFor(model.name);
    try {
      for (const [key, field] of Object.entries(model.fields)) {
        for (const targetModel of relationTargetOf(field)) {
          const col = quotedColumnFor(key);
          const target = quotedTableFor(targetModel);
          const name = quoteIdent(`${table}_${columnNameFor(key)}_fk`);
          await this.db.query(
            `DO $$ BEGIN
    ALTER TABLE ${qualified} ADD CONSTRAINT ${name}
      FOREIGN KEY (${col}) REFERENCES ${target} (id)
      ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  END $$;`,
          );
        }
      }
      return true;
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }

  private async ensureOutboxTable(errorBox: DbErrorBox): Promise<boolean> {
    const sql = `CREATE TABLE IF NOT EXISTS ${outboxTableName} (
    external_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    entity_id TEXT NOT NULL,
    model TEXT NOT NULL,
    run_id TEXT NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 1,
    step_index INTEGER NOT NULL DEFAULT 0,
    step TEXT NOT NULL DEFAULT 'compensatable',
    next_attempt_at TIMESTAMPTZ,
    error TEXT,
    compensation_of TEXT,
    dispatched_at TIMESTAMPTZ
  )`;
    try {
      await this.db.query(sql);
      await this.db.query(
        `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1`,
      );
      await this.db.query(
        `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS step_index INTEGER NOT NULL DEFAULT 0`,
      );
      await this.db.query(
        `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS step TEXT NOT NULL DEFAULT 'compensatable'`,
      );
      await this.db.query(
        `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ`,
      );
      await this.db.query(`ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS error TEXT`);
      await this.db.query(
        `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS compensation_of TEXT`,
      );
      await this.db.query(
        `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ`,
      );
      await this.db.query(
        `CREATE INDEX IF NOT EXISTS fookie_outbox_due_idx ON ${outboxTableName} (status, next_attempt_at)`,
      );
      await this.db.query(
        `CREATE INDEX IF NOT EXISTS fookie_outbox_run_idx ON ${outboxTableName} (run_id, step_index)`,
      );
      return this.ensureRunTable(errorBox);
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }

  private async ensureRunTable(errorBox: DbErrorBox): Promise<boolean> {
    const sql = `CREATE TABLE IF NOT EXISTS ${runTableName} (
    run_id TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    body JSONB NOT NULL,
    filter JSONB NOT NULL,
    saga_phase TEXT NOT NULL DEFAULT 'forward',
    pivot_external_id TEXT,
    error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
    try {
      await this.db.query(sql);
      await this.db.query(
        `ALTER TABLE ${runTableName} ADD COLUMN IF NOT EXISTS saga_phase TEXT NOT NULL DEFAULT 'forward'`,
      );
      await this.db.query(
        `ALTER TABLE ${runTableName} ADD COLUMN IF NOT EXISTS pivot_external_id TEXT`,
      );
      await this.db.query(`ALTER TABLE ${runTableName} ADD COLUMN IF NOT EXISTS error TEXT`);
      await this.db.query(
        `ALTER TABLE ${runTableName} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      );
      await this.db.query(
        `CREATE INDEX IF NOT EXISTS fookie_run_phase_idx ON ${runTableName} (saga_phase)`,
      );
      return true;
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }

  async upsertEntity(model: ModelDef<ModelFieldsInput>, entity: EntityRecord): Promise<boolean> {
    try {
      const plan = UpsertSql.fromEntity(model, entity);
      await this.db.query(plan.sql, plan.values.slice());
      return true;
    } catch (err) {
      if (err instanceof PgEncodeError || err instanceof ModelFieldError) {
        return false;
      }
      return this.failQuery(err);
    }
  }

  async loadEntity(
    model: ModelDef<ModelFieldsInput>,
    entityId: string,
    lock: readonly LockMode[] = [],
  ): Promise<EntityRecord> {
    const table = quotedTableFor(model.name);
    const sql = `SELECT * FROM ${table} WHERE id = $1 AND is_deleted = false${lockSqlFor(lock)}`;
    try {
      const queryResult = await this.db.query(sql, [entityId]);
      const rows = firstQueryRow(queryResult.rows);
      if (rows.length < 1) {
        throw NotFoundError.create("entity not found");
      }
      for (const row of rows) {
        try {
          const cells = pgRowCells(row);
          return rowToEntity(model, cells);
        } catch (err) {
          if (err instanceof PgEncodeError) {
            throw DatabaseError.create("entity row invalid");
          }
          throw err;
        }
      }
      throw NotFoundError.create("entity not found");
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof DatabaseError) {
        throw err;
      }
      const message = dbErrorMessageForLog(err, "database unavailable");
      for (const reportDbError of this.onDbError) {
        reportDbError(message);
        break;
      }
      throw DatabaseError.create(message);
    }
  }

  async queryEntities(
    model: ModelDef<ModelFieldsInput>,
    filter: FilterState,
    page: ListPage = emptyListPage(),
  ): Promise<EntityRecord[]> {
    const where = WhereSql.fromFilter(model, filter);
    const table = quotedTableFor(model.name);
    const tail = pageSqlFor(model, page, where.params.length + 1);
    const sql = `SELECT * FROM ${table} WHERE ${where.sql}${tail.sql}`;
    const bound = where.params.concat(tail.params);
    try {
      const queryResult = await this.db.query(sql, bound.slice());
      let entities: readonly EntityRecord[] = [];
      for (const row of queryResult.rows) {
        try {
          const cells = pgRowCells(row);
          entities = appendItem(entities, rowToEntity(model, cells));
        } catch (err) {
          if (err instanceof PgEncodeError) {
            throw DatabaseError.create("entity row invalid");
          }
          throw err;
        }
      }
      return entities.slice();
    } catch (err) {
      if (err instanceof ModelFieldError || err instanceof DatabaseError) {
        throw err;
      }
      this.failQuery(err);
      throw DatabaseError.create(dbErrorMessageForLog(err, "database unavailable"));
    }
  }

  async saveOutboxEntry(outboxRow: OutboxEntry): Promise<boolean> {
    const conflict =
      "ON CONFLICT (external_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, input = EXCLUDED.input, output = EXCLUDED.output, entity_id = EXCLUDED.entity_id, model = EXCLUDED.model, run_id = EXCLUDED.run_id, attempt = EXCLUDED.attempt, step_index = EXCLUDED.step_index, step = EXCLUDED.step, next_attempt_at = EXCLUDED.next_attempt_at, error = EXCLUDED.error, compensation_of = EXCLUDED.compensation_of, dispatched_at = EXCLUDED.dispatched_at";
    const nextAttemptAt = firstTextOrAbsent(outboxRow.nextAttemptAt);
    const errorText = firstTextOrAbsent(outboxRow.error);
    const compensationOf = firstTextOrAbsent(outboxRow.compensationOf);
    const dispatchedAt = firstTextOrAbsent(outboxRow.dispatchedAt);
    try {
      if (outboxRow.status === "completed") {
        const sql = `INSERT INTO ${outboxTableName} (external_id, name, status, input, output, entity_id, model, run_id, attempt, step_index, step, next_attempt_at, error, compensation_of, dispatched_at)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, NULLIF($12, '__fookie_absent__')::timestamptz, NULLIF($13, '__fookie_absent__'), NULLIF($14, '__fookie_absent__'), NULLIF($15, '__fookie_absent__')::timestamptz)
    ${conflict}`;
        await this.db.query(sql, [
          outboxRow.externalId,
          outboxRow.name,
          outboxRow.status,
          JSON.stringify(outboxRow.input),
          JSON.stringify(outboxRow.output),
          outboxRow.entityId,
          outboxRow.model,
          outboxRow.runId,
          outboxRow.attempt,
          outboxRow.stepIndex,
          outboxRow.undoable === true ? "compensatable" : "plain",
          nextAttemptAt,
          errorText,
          compensationOf,
          dispatchedAt,
        ]);
        return true;
      }
      const sql = `INSERT INTO ${outboxTableName} (external_id, name, status, input, output, entity_id, model, run_id, attempt, step_index, step, next_attempt_at, error, compensation_of, dispatched_at)
    VALUES ($1, $2, $3, $4::jsonb, NULL::jsonb, $5, $6, $7, $8, $9, $10, NULLIF($11, '__fookie_absent__')::timestamptz, NULLIF($12, '__fookie_absent__'), NULLIF($13, '__fookie_absent__'), NULLIF($14, '__fookie_absent__')::timestamptz)
    ${conflict}`;
      await this.db.query(sql, [
        outboxRow.externalId,
        outboxRow.name,
        outboxRow.status,
        JSON.stringify(outboxRow.input),
        outboxRow.entityId,
        outboxRow.model,
        outboxRow.runId,
        outboxRow.attempt,
        outboxRow.stepIndex,
        outboxRow.undoable === true ? "compensatable" : "plain",
        nextAttemptAt,
        errorText,
        compensationOf,
        dispatchedAt,
      ]);
      return true;
    } catch (err) {
      return this.failQuery(err);
    }
  }

  async loadOutbox(outbox: Map<string, OutboxEntry>, errorBox: DbErrorBox): Promise<boolean> {
    const sql = `SELECT ${outboxColumns} FROM ${outboxTableName} WHERE status <> 'completed' OR run_id IN (SELECT run_id FROM ${runTableName} WHERE saga_phase NOT IN ('completed', 'compensated'))`;
    try {
      const queryResult = await this.db.query(sql);
      for (const row of queryResult.rows) {
        const entries = outboxEntryFromRow(row);
        if (entries.length < 1) {
          return false;
        }
        for (const outboxRow of entries) {
          outbox.set(outboxRow.externalId, outboxRow);
        }
      }
      return true;
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }

  async pruneSettledRuns(cutoffIso: string): Promise<readonly string[]> {
    const findSql = `SELECT run_id FROM ${runTableName}
    WHERE saga_phase IN ('completed', 'compensated') AND updated_at < $1::timestamptz
    LIMIT 500`;
    try {
      const found = await this.db.query(findSql, [cutoffIso]);
      let runIds: readonly string[] = [];
      for (const row of found.rows) {
        const parsed = z.string().min(1).safeParse(row.run_id);
        if (parsed.success === true) {
          runIds = appendItem(runIds, parsed.data);
        }
      }
      if (runIds.length < 1) {
        return [];
      }
      for (const runId of runIds) {
        await this.db.query(`DELETE FROM ${outboxTableName} WHERE run_id = $1`, [runId]);
        await this.db.query(`DELETE FROM ${runTableName} WHERE run_id = $1`, [runId]);
      }
      return runIds;
    } catch (err) {
      this.failQuery(err);
      return [];
    }
  }

  async queryRuns(query: RunQuery): Promise<readonly RunStateRow[]> {
    const built = boundInList("saga_phase", query.phase, 1);
    const limitIndex = built.params.length + 1;
    const sql = `SELECT ${runColumns} FROM ${runTableName} WHERE ${built.sql} ORDER BY updated_at DESC, run_id ASC LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`;
    const bound = built.params.concat([pageBound(query.limit), pageBound(query.offset)]);
    try {
      const queryResult = await this.db.query(sql, bound.slice());
      let rows: readonly RunStateRow[] = [];
      for (const row of queryResult.rows) {
        for (const state of runStateFromRow(row)) {
          rows = appendItem(rows, state);
        }
      }
      return rows;
    } catch (err) {
      this.failQuery(err);
      throw DatabaseError.create(dbErrorMessageForLog(err, "database unavailable"));
    }
  }

  async queryOutbox(query: OutboxQuery): Promise<readonly OutboxEntry[]> {
    const byStatus = boundInList("status", query.status, 1);
    const byRun = boundInList("run_id", query.runId, byStatus.params.length + 1);
    const limitIndex = byStatus.params.length + byRun.params.length + 1;
    const sql = `SELECT ${outboxColumns} FROM ${outboxTableName} WHERE ${byStatus.sql} AND ${byRun.sql} ORDER BY run_id ASC, step_index ASC LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`;
    const bound = byStatus.params
      .concat(byRun.params)
      .concat([pageBound(query.limit), pageBound(query.offset)]);
    try {
      const queryResult = await this.db.query(sql, bound.slice());
      let rows: readonly OutboxEntry[] = [];
      for (const row of queryResult.rows) {
        for (const outboxRow of outboxEntryFromRow(row)) {
          rows = appendItem(rows, outboxRow);
        }
      }
      return rows;
    } catch (err) {
      this.failQuery(err);
      throw DatabaseError.create(dbErrorMessageForLog(err, "database unavailable"));
    }
  }

  async saveRunState(runState: RunStateWrite): Promise<boolean> {
    const sql = `INSERT INTO ${runTableName} (run_id, model, entity_id, operation, body, filter, saga_phase, pivot_external_id, error, updated_at)
    VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, NULLIF($8, '__fookie_absent__'), NULLIF($9, '__fookie_absent__'), NOW())
    ON CONFLICT (run_id) DO UPDATE SET model = EXCLUDED.model, entity_id = EXCLUDED.entity_id, operation = EXCLUDED.operation, body = EXCLUDED.body, filter = EXCLUDED.filter, saga_phase = EXCLUDED.saga_phase, pivot_external_id = EXCLUDED.pivot_external_id, error = EXCLUDED.error, updated_at = NOW()`;
    try {
      await this.db.query(sql, [
        runState.runId,
        runState.model,
        runState.entityId,
        runState.operation,
        JSON.stringify(runState.body),
        runState.filterJson,
        runState.phase,
        firstTextOrAbsent(runState.pivotExternalId),
        firstTextOrAbsent(runState.error),
      ]);
      return true;
    } catch (err) {
      return this.failQuery(err);
    }
  }

  async loadRunState(runId: string): Promise<readonly RunStateRow[]> {
    const sql = `SELECT ${runColumns} FROM ${runTableName} WHERE run_id = $1`;
    try {
      const queryResult = await this.db.query(sql, [runId]);
      let rows: readonly RunStateRow[] = [];
      for (const row of queryResult.rows) {
        for (const runState of runStateFromRow(row)) {
          rows = appendItem(rows, runState);
        }
      }
      return rows;
    } catch (err) {
      this.failQuery(err);
      return [];
    }
  }

  async loadResumableRuns(limit: number): Promise<readonly RunStateRow[]> {
    const sql = `SELECT ${runColumns} FROM ${runTableName}
    WHERE saga_phase IN ('forward', 'compensating')
    ORDER BY updated_at ASC
    LIMIT $1`;
    try {
      const queryResult = await this.db.query(sql, [limit]);
      let rows: readonly RunStateRow[] = [];
      for (const row of queryResult.rows) {
        for (const runState of runStateFromRow(row)) {
          rows = appendItem(rows, runState);
        }
      }
      return rows;
    } catch (err) {
      this.failQuery(err);
      return [];
    }
  }
}

export async function getEntity(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  lock: readonly LockMode[] = [],
): Promise<EntityRecord> {
  const key = entityStoreKey(model.name, entityId);
  const cacheable = lock.length === 0;
  for (const cached of cacheable ? mapLookup(rt.entities, key) : []) {
    if (cached.id !== entityId) {
      rt.entities.delete(key);
    } else {
      const deletedValues = entityValueAt(cached, "isDeleted");
      for (const deleted of deletedValues) {
        if (deleted === true) {
          rt.entities.delete(key);
          throw NotFoundError.create("entity not found");
        }
      }
      return cached;
    }
  }
  try {
    const fromDb = await rt.store.loadEntity(model, entityId, lock);
    rt.entities.set(key, fromDb);
    return fromDb;
  } catch (err) {
    if (err instanceof DatabaseError) {
      logDatabaseFailure(rt);
    }
    throw err;
  }
}

export async function persistEntity(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  entity: EntityRecord,
): Promise<boolean> {
  const dbOk = await rt.awaitDb();
  if (dbOk === false) {
    logDatabaseFailure(rt);
    return false;
  }
  const ok = await rt.store.upsertEntity(model, entity);
  if (ok === false) {
    logDatabaseFailure(rt);
    return false;
  }
  const key = entityStoreKey(model.name, entityId);
  rt.pendingEntityWrites.rows = appendItem(rt.pendingEntityWrites.rows, { key, entity });
  rt.entities.delete(key);
  return true;
}
