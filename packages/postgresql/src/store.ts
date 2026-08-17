import { z } from "zod";
import type { OutboxEntry } from "@fookiejs/core";
import { DatabaseError, ModelFieldError, NotFoundError, PgEncodeError } from "@fookiejs/core";
import { emptyListPage } from "@fookiejs/core";
import type { FilterState, ListPage } from "@fookiejs/core";
import type { ModelDef, ModelFieldsInput } from "@fookiejs/core";
import type { Database } from "@fookiejs/core";
import { captureDbError, sqlStateOf, dbErrorMessageForLog, pgRowCells } from "@fookiejs/core";
import type { DbErrorBox, PgParam, PgRow } from "@fookiejs/core";
import { outboxTableName, quotedTableFor, runTableName } from "@fookiejs/core";
import type { InjectablePool, PgQueryResult, PgQueryable } from "./pool.ts";
import { postgresSession } from "./session.ts";
import type { StoreSession } from "@fookiejs/core";
import {
  firstTextOrAbsent,
  outboxColumns,
  outboxEntryFromRow,
  runColumns,
  runStateFromRow,
} from "./rows.ts";
import type { OperationEvent, RunStateRow, RunStateWrite } from "@fookiejs/core";
import { UpsertSql } from "./upsert.ts";
import { WhereSql } from "./where.ts";
import { appendItem } from "@fookiejs/core";
import type { CaughtFailure, EntityRecord } from "@fookiejs/core";

export type { RunStateRow } from "@fookiejs/core";

import type { LockMode, OutboxQuery, RunQuery, StoreDbErrorHandler } from "@fookiejs/core";
import { boundInList, lockSqlFor, pageBound, pageSqlFor, rowToEntity } from "./sql.ts";
import { settledChannel } from "./notify-bus.ts";
import {
  modelForeignKeyStatements,
  modelTableStatements,
  outboxTableStatements,
  runTableStatements,
  schemaVersionStatements,
} from "./ddl.ts";

export class PostgresStore {
  private readonly db: PgQueryable;
  private readonly onDbError: readonly StoreDbErrorHandler[];
  private readonly opener: readonly InjectablePool[];
  private readonly stateBox: { codes: readonly string[] } = { codes: [] };

  private constructor(
    db: PgQueryable,
    onDbError: readonly StoreDbErrorHandler[],
    opener: readonly InjectablePool[],
  ) {
    if (z.function().safeParse(db.query).success === false) {
      throw DatabaseError.create("database client required");
    }
    if (Array.isArray(onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    if (Array.isArray(opener) === false) {
      throw DatabaseError.create("database opener required");
    }
    this.db = { query: (sql, params = []) => this.noteFailures(db, sql, params) };
    this.onDbError = onDbError;
    this.opener = opener;
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

  static create(
    db: PgQueryable,
    onDbError: readonly StoreDbErrorHandler[] = [],
    opener: readonly InjectablePool[] = [],
  ): PostgresStore {
    if (z.function().safeParse(db.query).success === false) {
      throw DatabaseError.create("database client required");
    }
    if (Array.isArray(onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    if (Array.isArray(opener) === false) {
      throw DatabaseError.create("database opener required");
    }
    return new PostgresStore(db, onDbError, opener);
  }

  async connectSession(): Promise<StoreSession> {
    if (Array.isArray(this.opener) === false) {
      throw DatabaseError.create("write session requires a pool");
    }
    for (const pool of this.opener) {
      const client = await pool.connect();
      const pinned = PostgresStore.create(client, this.onDbError, []);
      return postgresSession(client, pinned);
    }
    throw DatabaseError.create("write session requires a pool");
  }

  withClient(client: PgQueryable): PostgresStore {
    if (z.function().safeParse(client.query).success === false) {
      throw DatabaseError.create("database client required");
    }
    if (Array.isArray(this.onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    return PostgresStore.create(client, this.onDbError, []);
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

  async applyDdlLockTimeout(timeoutMs: number): Promise<boolean> {
    if (Number.isInteger(timeoutMs) === false) {
      throw DatabaseError.create("ddl lock timeout must be an integer");
    }
    if (timeoutMs < 1) {
      throw DatabaseError.create("ddl lock timeout must be positive");
    }
    try {
      await this.db.query(`SET lock_timeout = ${timeoutMs}`);
      return true;
    } catch {
      return false;
    }
  }

  async removeEntityRow(
    models: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    modelName: string,
    entityId: string,
  ): Promise<boolean> {
    for (const model of models) {
      if (model.name !== modelName) {
        continue;
      }
      const table = quotedTableFor(model.name);
      try {
        await this.db.query(`DELETE FROM ${table} WHERE id = $1`, [entityId]);
        return true;
      } catch (err) {
        return this.failQuery(err);
      }
    }
    throw DatabaseError.create("unknown model cannot be rolled back");
  }

  async ensureAllTables(
    modelsOnStore: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    allModels: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    fallbackDatabase: Database,
    errorBox: DbErrorBox,
    options: { control: boolean },
  ): Promise<boolean> {
    for (const model of modelsOnStore) {
      const ok = await this.runStatements(modelTableStatements(model), errorBox);
      if (ok === false) {
        return false;
      }
    }
    for (const model of modelsOnStore) {
      const linked = await this.runStatements(
        modelForeignKeyStatements(model, allModels, fallbackDatabase),
        errorBox,
      );
      if (linked === false) {
        return false;
      }
    }
    if (options.control === false) {
      return true;
    }
    const outbox = await this.runStatements(outboxTableStatements(), errorBox);
    if (outbox === false) {
      return false;
    }
    const runs = await this.runStatements(runTableStatements(), errorBox);
    if (runs === false) {
      return false;
    }
    return this.runStatements(schemaVersionStatements(), errorBox);
  }

  private async runStatements(
    statements: readonly string[],
    errorBox: DbErrorBox,
  ): Promise<boolean> {
    try {
      for (const statement of statements) {
        await this.db.query(statement);
      }
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
      if (Array.isArray(queryResult.rows) === false) {
        throw DatabaseError.create("query rows required");
      }
      for (const row of queryResult.rows) {
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
      "ON CONFLICT (external_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, input = EXCLUDED.input, output = EXCLUDED.output, entity_id = EXCLUDED.entity_id, model = EXCLUDED.model, run_id = EXCLUDED.run_id, attempt = EXCLUDED.attempt, step_index = EXCLUDED.step_index, step = EXCLUDED.step, next_attempt_at = EXCLUDED.next_attempt_at, error = EXCLUDED.error, compensation_of = EXCLUDED.compensation_of, dispatched_at = EXCLUDED.dispatched_at, leased_by = NULL, leased_until = NULL";
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

  async loadOutboxById(externalId: string): Promise<readonly OutboxEntry[]> {
    if (z.string().min(1).safeParse(externalId).success === false) {
      return [];
    }
    const sql = `SELECT ${outboxColumns} FROM ${outboxTableName} WHERE external_id = $1`;
    try {
      const queryResult = await this.db.query(sql, [externalId]);
      let rows: readonly OutboxEntry[] = [];
      for (const row of queryResult.rows) {
        for (const outboxRow of outboxEntryFromRow(row)) {
          rows = appendItem(rows, outboxRow);
        }
      }
      return rows;
    } catch (err) {
      this.failQuery(err);
      return [];
    }
  }

  async claimDueOutbox(
    workerId: string,
    nowIso: string,
    limit: number,
  ): Promise<readonly OutboxEntry[]> {
    if (z.string().min(1).safeParse(workerId).success === false) {
      return [];
    }
    if (z.string().min(1).safeParse(nowIso).success === false) {
      return [];
    }
    if (Number.isInteger(limit) === false || limit < 1) {
      return [];
    }
    const leaseMs = 30_000;
    const leasedUntil = new Date(Date.parse(nowIso) + leaseMs).toISOString();
    const sql = `UPDATE ${outboxTableName} AS o
SET leased_by = $1,
    leased_until = $2::timestamptz
WHERE o.external_id IN (
  SELECT external_id
  FROM ${outboxTableName}
  WHERE status = 'pending'
    AND (next_attempt_at IS NULL OR next_attempt_at <= $3::timestamptz)
    AND (leased_until IS NULL OR leased_until <= $3::timestamptz)
  ORDER BY next_attempt_at NULLS FIRST, external_id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT $4
)
RETURNING ${outboxColumns}`;
    try {
      const queryResult = await this.db.query(sql, [workerId, leasedUntil, nowIso, limit]);
      let rows: readonly OutboxEntry[] = [];
      for (const row of queryResult.rows) {
        for (const outboxRow of outboxEntryFromRow(row)) {
          rows = appendItem(rows, outboxRow);
        }
      }
      return rows;
    } catch (err) {
      this.failQuery(err);
      return [];
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
    const sql = `SELECT ${outboxColumns} FROM ${outboxTableName} WHERE ${byStatus.sql} AND ${byRun.sql} ORDER BY run_id DESC, step_index ASC LIMIT $${limitIndex} OFFSET $${limitIndex + 1}`;
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

  async announceOperation(event: OperationEvent): Promise<boolean> {
    try {
      await this.db.query("SELECT pg_notify($1, $2)", [
        settledChannel,
        JSON.stringify({
          model: event.model,
          operation: event.operation,
          id: event.id,
          runId: event.runId,
          signal: event.signal,
        }),
      ]);
      return true;
    } catch (err) {
      return this.failQuery(err);
    }
  }
}
