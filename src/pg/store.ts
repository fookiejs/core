import { z } from "zod";
import { logDatabaseFailure } from "../engine/flow.ts";
import type { OutboxEntry } from "../engine/outbox.ts";
import type { Runtime } from "../engine/runtime.ts";
import { DatabaseError, ModelFieldError, NotFoundError, PgEncodeError } from "../errors.ts";
import type { FilterState } from "../filter/ops.ts";
import { entityStoreKey, isRelationField, isSystemFieldKey } from "../model.ts";
import type { ModelDef, ModelFieldsInput } from "../model.ts";
import {
  captureDbError,
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
  runTableName,
  tableNameFor,
  toCamelCase,
} from "./naming.ts";
import type { PgQueryable } from "./pool.ts";
import {
  firstTextOrAbsent,
  outboxColumns,
  outboxEntryFromRow,
  runColumns,
  runStateFromRow,
} from "./rows.ts";
import type { RunStateRow } from "./rows.ts";
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

export type StoreDbErrorHandler = (message: string) => void;

export class PostgresStore {
  private readonly db: PgQueryable;
  private readonly onDbError: readonly StoreDbErrorHandler[];

  private constructor(db: PgQueryable, onDbError: readonly StoreDbErrorHandler[]) {
    if (z.function().safeParse(db.query).success === false) {
      throw DatabaseError.create("database client required");
    }
    if (Array.isArray(onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    this.db = db;
    this.onDbError = onDbError;
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
    return this.ensureOutboxTable(errorBox);
  }

  private async ensureModelTable(
    model: ModelDef<ModelFieldsInput>,
    errorBox: DbErrorBox,
  ): Promise<boolean> {
    const table = tableNameFor(model.name);
    const qualified = `public.${table}`;
    let columns: readonly string[] = [];
    for (const [key, field] of Object.entries(model.fields)) {
      const col = columnNameFor(key);
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
        const col = columnNameFor(alterKey);
        const type = pgColumnType(alterField);
        let alterSql = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS ${col} ${type}`;
        if (alterKey === "isDeleted") {
          alterSql = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS ${col} ${type} NOT NULL DEFAULT false`;
        } else if (alterKey === "createdAt" || alterKey === "updatedAt") {
          alterSql = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS ${col} ${type} NOT NULL DEFAULT NOW()`;
        }
        await this.db.query(alterSql);
        if (isRelationField(alterField) === false && alterField.meta.unique) {
          await this.db.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_${col}_uidx ON ${qualified} (${col})`,
          );
        }
        if (
          isRelationField(alterField) === false &&
          alterField.meta.index &&
          alterField.meta.unique === false
        ) {
          await this.db.query(
            `CREATE INDEX IF NOT EXISTS ${table}_${col}_idx ON ${qualified} (${col})`,
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
    compensation_of TEXT
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

  async loadEntity(model: ModelDef<ModelFieldsInput>, entityId: string): Promise<EntityRecord> {
    const table = `public.${tableNameFor(model.name)}`;
    const sql = `SELECT * FROM ${table} WHERE id = $1 AND is_deleted = false`;
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
  ): Promise<EntityRecord[]> {
    const where = WhereSql.fromFilter(model, filter);
    const table = `public.${tableNameFor(model.name)}`;
    const sql = `SELECT * FROM ${table} WHERE ${where.sql}`;
    try {
      const queryResult = await this.db.query(sql, where.params.slice());
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
      "ON CONFLICT (external_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, input = EXCLUDED.input, output = EXCLUDED.output, entity_id = EXCLUDED.entity_id, model = EXCLUDED.model, run_id = EXCLUDED.run_id, attempt = EXCLUDED.attempt, step_index = EXCLUDED.step_index, step = EXCLUDED.step, next_attempt_at = EXCLUDED.next_attempt_at, error = EXCLUDED.error, compensation_of = EXCLUDED.compensation_of";
    const nextAttemptAt = firstTextOrAbsent(outboxRow.nextAttemptAt);
    const errorText = firstTextOrAbsent(outboxRow.error);
    const compensationOf = firstTextOrAbsent(outboxRow.compensationOf);
    try {
      if (outboxRow.status === "completed") {
        const sql = `INSERT INTO ${outboxTableName} (external_id, name, status, input, output, entity_id, model, run_id, attempt, step_index, step, next_attempt_at, error, compensation_of)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, NULLIF($12, '__fookie_absent__')::timestamptz, NULLIF($13, '__fookie_absent__'), NULLIF($14, '__fookie_absent__'))
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
        ]);
        return true;
      }
      const sql = `INSERT INTO ${outboxTableName} (external_id, name, status, input, output, entity_id, model, run_id, attempt, step_index, step, next_attempt_at, error, compensation_of)
    VALUES ($1, $2, $3, $4::jsonb, NULL::jsonb, $5, $6, $7, $8, $9, $10, NULLIF($11, '__fookie_absent__')::timestamptz, NULLIF($12, '__fookie_absent__'), NULLIF($13, '__fookie_absent__'))
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

  async saveRunState(runState: RunStateRow): Promise<boolean> {
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
    WHERE saga_phase IN ('forward', 'settling', 'compensating')
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
): Promise<EntityRecord> {
  const key = entityStoreKey(model.name, entityId);
  for (const cached of mapLookup(rt.entities, key)) {
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
    const fromDb = await rt.store.loadEntity(model, entityId);
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
