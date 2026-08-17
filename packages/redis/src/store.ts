import { z } from "zod";
import type { OutboxEntry } from "@fookiejs/core";
import { DatabaseError, NotFoundError } from "@fookiejs/core";
import { entityMatchesFilter } from "@fookiejs/core";
import { emptyListPage } from "@fookiejs/core";
import type { FilterState, ListPage } from "@fookiejs/core";
import { isSystemFieldKey } from "@fookiejs/core";
import type { ModelDef, ModelFieldsInput } from "@fookiejs/core";
import { captureDbError, dbErrorMessageForLog } from "@fookiejs/core";
import type { DbErrorBox, PgParam, PgRow } from "@fookiejs/core";
import { tableNameFor } from "@fookiejs/core";
import type { LockMode, OutboxQuery, RunQuery, StoreDbErrorHandler } from "@fookiejs/core";
import { pageBound } from "@fookiejs/core";
import type { RunStateRow, RunStateWrite } from "@fookiejs/core";
import { appendItem } from "@fookiejs/core";
import { entityRecordFromJson, entityValueAt } from "@fookiejs/core";
import type { CaughtFailure, EntityRecord } from "@fookiejs/core";
import type { EntityStore, StoreSession } from "@fookiejs/core";
import type { Database } from "@fookiejs/core";
import { pageEntities } from "@fookiejs/core";
import { compareOutboxOrder, compareRunOrder, parseOutbox, parseRun, slicePage } from "./codec.ts";
import type { RedisDriver } from "./driver.ts";
import {
  entityKey,
  isDeletedEntity,
  liveKey,
  planeKey,
  planePitch,
  uniqueKey,
  uniqueText,
} from "./keys.ts";
import { redisSession } from "./session.ts";

function boundPair(field: unknown): readonly { gte: number; lt: number }[] {
  if (
    field === undefined ||
    typeof field !== "object" ||
    field === null ||
    Array.isArray(field) === true
  ) {
    return [];
  }
  const rec = field as Record<string, unknown>;
  const keys = Object.keys(rec);
  if (keys.length !== 2) {
    return [];
  }
  if (keys.includes("gte") === false || keys.includes("lt") === false) {
    return [];
  }
  const gte = rec.gte;
  const lt = rec.lt;
  if (typeof gte !== "number" || typeof lt !== "number") {
    return [];
  }
  if (Number.isFinite(gte) === false || Number.isFinite(lt) === false) {
    return [];
  }
  return [{ gte, lt }];
}

function alignedPlane(filter: FilterState): readonly { col: number; row: number }[] {
  const keys = Object.keys(filter);
  if (keys.length !== 2) {
    return [];
  }
  if (keys.includes("x") === false || keys.includes("y") === false) {
    return [];
  }
  const xs = boundPair(filter.x);
  const ys = boundPair(filter.y);
  if (xs.length !== 1 || ys.length !== 1) {
    return [];
  }
  const x = xs[0];
  const y = ys[0];
  if (x === undefined || y === undefined) {
    return [];
  }
  if (x.lt - x.gte !== planePitch) {
    return [];
  }
  if (y.lt - y.gte !== planePitch) {
    return [];
  }
  const col = x.gte / planePitch;
  const row = y.gte / planePitch;
  if (Number.isInteger(col) === false || Number.isInteger(row) === false) {
    return [];
  }
  return [{ col, row }];
}

function planeOf(entity: EntityRecord): readonly { col: number; row: number }[] {
  const xs = entityValueAt(entity, "x");
  const ys = entityValueAt(entity, "y");
  if (xs.length !== 1 || ys.length !== 1) {
    return [];
  }
  const x = xs[0];
  const y = ys[0];
  if (typeof x !== "number" || typeof y !== "number") {
    return [];
  }
  if (Number.isFinite(x) === false || Number.isFinite(y) === false) {
    return [];
  }
  return [{ col: Math.floor(x / planePitch), row: Math.floor(y / planePitch) }];
}

function samePlane(
  left: readonly { col: number; row: number }[],
  right: readonly { col: number; row: number }[],
): boolean {
  if (left.length !== 1 || right.length !== 1) {
    return false;
  }
  const a = left[0];
  const b = right[0];
  if (a === undefined || b === undefined) {
    return false;
  }
  if (a.col !== b.col) {
    return false;
  }
  if (a.row !== b.row) {
    return false;
  }
  return true;
}

function idLookup(filter: FilterState): { found: false } | { found: true; ids: readonly string[] } {
  const keys = Object.keys(filter);
  if (keys.length !== 1) {
    return { found: false };
  }
  if (keys[0] !== "id") {
    return { found: false };
  }
  const idField = filter.id;
  if (idField === undefined) {
    return { found: false };
  }
  const ops = Object.keys(idField);
  if (ops.length !== 1) {
    return { found: false };
  }
  if (ops[0] === "eq") {
    const eq = idField.eq;
    if (typeof eq !== "string") {
      return { found: false };
    }
    if (eq.length < 1) {
      return { found: false };
    }
    return { found: true, ids: [eq] };
  }
  if (ops[0] === "in") {
    const held = idField.in;
    if (Array.isArray(held) === false) {
      return { found: false };
    }
    let ids: readonly string[] = [];
    for (const item of held) {
      if (typeof item !== "string") {
        continue;
      }
      if (item.length < 1) {
        continue;
      }
      ids = appendItem(ids, item);
    }
    return { found: true, ids };
  }
  return { found: false };
}

export class RedisStore implements EntityStore {
  private readonly driver: RedisDriver;
  private readonly onDbError: readonly StoreDbErrorHandler[];

  private constructor(driver: RedisDriver, onDbError: readonly StoreDbErrorHandler[]) {
    if (z.instanceof(Function).safeParse(driver.get).success === false) {
      throw DatabaseError.create("redis driver required");
    }
    if (Array.isArray(onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    this.driver = driver;
    this.onDbError = onDbError;
  }

  static create(driver: RedisDriver, onDbError: readonly StoreDbErrorHandler[] = []): RedisStore {
    if (z.instanceof(Function).safeParse(driver.get).success === false) {
      throw DatabaseError.create("redis driver required");
    }
    if (Array.isArray(onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    return new RedisStore(driver, onDbError);
  }

  lastSqlState(): readonly string[] {
    const codes: readonly string[] = [];
    if (Array.isArray(codes) === false) {
      throw DatabaseError.create("sql state box required");
    }
    if (codes.length > 0) {
      throw DatabaseError.create("redis has no sql state");
    }
    return codes;
  }

  async connectSession(): Promise<StoreSession> {
    const connected = await this.driver.connect();
    if (connected === false) {
      throw DatabaseError.create("redis connect failed");
    }
    const store = this;
    if (z.looseObject({}).safeParse(store).success === false) {
      throw DatabaseError.create("redis store required");
    }
    return redisSession(store);
  }

  selectRows(sql: string, params: readonly PgParam[]): Promise<readonly PgRow[]> {
    if (z.string().min(1).safeParse(sql).success === false) {
      return Promise.reject(DatabaseError.create("sql is a postgres query"));
    }
    if (Array.isArray(params) === false) {
      return Promise.reject(DatabaseError.create("sql is a postgres query"));
    }
    return Promise.reject(DatabaseError.create("sql is a postgres query"));
  }

  async applyDdlLockTimeout(timeoutMs: number): Promise<boolean> {
    if (Number.isInteger(timeoutMs) === false) {
      throw DatabaseError.create("ddl lock timeout must be an integer");
    }
    if (timeoutMs < 1) {
      throw DatabaseError.create("ddl lock timeout must be positive");
    }
    const connected = await this.driver.connect();
    return connected;
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

  async removeEntityRow(
    models: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    modelName: string,
    entityId: string,
  ): Promise<boolean> {
    for (const model of models) {
      if (model.name !== modelName) {
        continue;
      }
      const table = tableNameFor(model.name);
      try {
        const held = await this.driver.get(entityKey(table, entityId));
        for (const raw of held) {
          const parsed = entityRecordFromJson(raw);
          for (const entity of parsed) {
            await this.dropPlane(table, entityId, entity);
          }
        }
        await this.driver.del(entityKey(table, entityId));
        await this.driver.sRem(liveKey(table), entityId);
        return true;
      } catch (err) {
        return this.failQuery(err);
      }
    }
    throw DatabaseError.create("unknown model cannot be rolled back");
  }

  async ensureAllTables(
    _modelsOnStore: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    _allModels: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    fallbackDatabase: Database,
    errorBox: DbErrorBox,
    _options: { control: boolean },
  ): Promise<boolean> {
    if (z.string().min(1).safeParse(fallbackDatabase.key).success === false) {
      errorBox.message = "app database required";
      return false;
    }
    try {
      const connected = await this.driver.connect();
      if (connected === false) {
        errorBox.message = "redis connect failed";
        return false;
      }
      return true;
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }

  async upsertEntity(model: ModelDef<ModelFieldsInput>, entity: EntityRecord): Promise<boolean> {
    const table = tableNameFor(model.name);
    const ids = entityValueAt(entity, "id");
    if (ids.length < 1) {
      return false;
    }
    for (const entityId of ids) {
      const idText = z.string().min(1).safeParse(entityId);
      if (idText.success === false) {
        return false;
      }
      try {
        const uniqueOk = await this.claimUniques(model, table, idText.data, entity);
        if (uniqueOk === false) {
          return false;
        }
        const previousHeld = await this.driver.get(entityKey(table, idText.data));
        let previous: readonly EntityRecord[] = [];
        for (const raw of previousHeld) {
          previous = entityRecordFromJson(raw);
          break;
        }
        await this.driver.set(entityKey(table, idText.data), JSON.stringify(entity));
        if (isDeletedEntity(entity) === true) {
          await this.driver.sRem(liveKey(table), idText.data);
        } else {
          await this.driver.sAdd(liveKey(table), idText.data);
        }
        await this.syncPlane(table, idText.data, previous, entity);
        return true;
      } catch (err) {
        return this.failQuery(err);
      }
    }
    return false;
  }

  private async dropPlane(table: string, entityId: string, entity: EntityRecord): Promise<boolean> {
    const at = planeOf(entity);
    if (at.length !== 1) {
      return true;
    }
    const cell = at[0];
    if (cell === undefined) {
      return true;
    }
    await this.driver.sRem(planeKey(table, cell.col, cell.row), entityId);
    return true;
  }

  private async indexPlane(table: string, entity: EntityRecord): Promise<boolean> {
    const ids = entityValueAt(entity, "id");
    if (ids.length < 1) {
      return true;
    }
    const idText = z.string().min(1).safeParse(ids[0]);
    if (idText.success === false) {
      return true;
    }
    const at = planeOf(entity);
    if (at.length !== 1) {
      return true;
    }
    const cell = at[0];
    if (cell === undefined) {
      return true;
    }
    await this.driver.sAdd(planeKey(table, cell.col, cell.row), idText.data);
    return true;
  }

  private async syncPlane(
    table: string,
    entityId: string,
    previous: readonly EntityRecord[],
    next: EntityRecord,
  ): Promise<boolean> {
    let oldAt: readonly { col: number; row: number }[] = [];
    for (const row of previous) {
      oldAt = planeOf(row);
      break;
    }
    const gone = isDeletedEntity(next) === true;
    const newAt = gone === true ? [] : planeOf(next);
    if (oldAt.length === 1 && samePlane(oldAt, newAt) === false) {
      for (const row of previous) {
        await this.dropPlane(table, entityId, row);
        break;
      }
    }
    if (gone === true) {
      return true;
    }
    if (newAt.length !== 1) {
      return true;
    }
    if (samePlane(oldAt, newAt) === true) {
      return true;
    }
    await this.indexPlane(table, next);
    return true;
  }

  private async entitiesByIds(
    model: ModelDef<ModelFieldsInput>,
    table: string,
    ids: readonly string[],
    filter: FilterState,
    page: ListPage,
  ): Promise<EntityRecord[]> {
    if (ids.length < 1) {
      return pageEntities(model, [], page);
    }
    let keys: readonly string[] = [];
    for (const entityId of ids) {
      keys = appendItem(keys, entityKey(table, entityId));
    }
    const blobs = await this.driver.mGet(keys);
    let selected: readonly EntityRecord[] = [];
    let index = 0;
    while (index < blobs.length) {
      const held = blobs[index];
      if (held === undefined) {
        index = index + 1;
        continue;
      }
      for (const raw of held) {
        const parsed = entityRecordFromJson(raw);
        for (const entity of parsed) {
          if (isDeletedEntity(entity) === true) {
            continue;
          }
          if (entityMatchesFilter(model, entity, filter) === false) {
            continue;
          }
          selected = appendItem(selected, entity);
        }
      }
      index = index + 1;
    }
    return pageEntities(model, selected, page);
  }

  private async claimUniques(
    model: ModelDef<ModelFieldsInput>,
    table: string,
    entityId: string,
    entity: EntityRecord,
  ): Promise<boolean> {
    for (const [key, field] of Object.entries(model.fields)) {
      if (isSystemFieldKey(key) === true) {
        continue;
      }
      if ("meta" in field === false) {
        continue;
      }
      if (field.meta.unique === false) {
        continue;
      }
      const heldHits = entityValueAt(entity, key);
      if (heldHits.length < 1) {
        continue;
      }
      for (const held of heldHits) {
        const texts = uniqueText(held);
        if (texts.length < 1) {
          continue;
        }
        for (const text of texts) {
          const slot = uniqueKey(table, key, text);
          const existing = await this.driver.get(slot);
          for (const owner of existing) {
            if (owner !== entityId) {
              return false;
            }
          }
          await this.driver.set(slot, entityId);
        }
      }
    }
    return true;
  }

  async loadEntity(
    model: ModelDef<ModelFieldsInput>,
    entityId: string,
    lock: readonly LockMode[] = [],
  ): Promise<EntityRecord> {
    if (Array.isArray(lock) === false) {
      throw DatabaseError.create("lock mode required");
    }
    const table = tableNameFor(model.name);
    try {
      const held = await this.driver.get(entityKey(table, entityId));
      if (held.length < 1) {
        throw NotFoundError.create("entity not found");
      }
      for (const raw of held) {
        const parsed = entityRecordFromJson(raw);
        if (parsed.length < 1) {
          throw DatabaseError.create("entity row invalid");
        }
        for (const entity of parsed) {
          if (isDeletedEntity(entity) === true) {
            throw NotFoundError.create("entity not found");
          }
          return entity;
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
    const table = tableNameFor(model.name);
    try {
      const lookup = idLookup(filter);
      if (lookup.found === true) {
        if (lookup.ids.length === 1) {
          try {
            let loaded: readonly EntityRecord[] = [];
            for (const id of lookup.ids) {
              loaded = appendItem(loaded, await this.loadEntity(model, id, []));
            }
            let matched: readonly EntityRecord[] = [];
            for (const entity of loaded) {
              if (entityMatchesFilter(model, entity, filter) === false) {
                continue;
              }
              matched = appendItem(matched, entity);
            }
            return pageEntities(model, matched, page);
          } catch (err) {
            if (err instanceof NotFoundError) {
              return [];
            }
            throw err;
          }
        }
        return await this.entitiesByIds(model, table, lookup.ids, filter, page);
      }
      const cell = alignedPlane(filter);
      if (cell.length === 1) {
        const at = cell[0];
        if (at === undefined) {
          return [];
        }
        const ids = await this.driver.sMembers(planeKey(table, at.col, at.row));
        return await this.entitiesByIds(model, table, ids, filter, page);
      }
      const ids = await this.driver.sMembers(liveKey(table));
      let keys: readonly string[] = [];
      for (const entityId of ids) {
        keys = appendItem(keys, entityKey(table, entityId));
      }
      const blobs = await this.driver.mGet(keys);
      let rows: readonly EntityRecord[] = [];
      let index = 0;
      while (index < blobs.length) {
        const held = blobs[index];
        if (held === undefined) {
          index = index + 1;
          continue;
        }
        for (const raw of held) {
          const parsed = entityRecordFromJson(raw);
          for (const entity of parsed) {
            if (isDeletedEntity(entity) === true) {
              continue;
            }
            await this.indexPlane(table, entity);
            if (entityMatchesFilter(model, entity, filter) === false) {
              continue;
            }
            rows = appendItem(rows, entity);
          }
        }
        index = index + 1;
      }
      return pageEntities(model, rows, page);
    } catch (err) {
      if (err instanceof DatabaseError) {
        throw err;
      }
      this.failQuery(err);
      throw DatabaseError.create(dbErrorMessageForLog(err, "database unavailable"));
    }
  }

  async saveOutboxEntry(outboxRow: OutboxEntry): Promise<boolean> {
    try {
      await this.driver.set(`o:${outboxRow.externalId}`, JSON.stringify(outboxRow));
      await this.driver.sAdd("oi", outboxRow.externalId);
      return true;
    } catch (err) {
      return this.failQuery(err);
    }
  }

  async loadOutbox(outbox: Map<string, OutboxEntry>, errorBox: DbErrorBox): Promise<boolean> {
    try {
      const ids = await this.driver.sMembers("oi");
      for (const externalId of ids) {
        const held = await this.driver.get(`o:${externalId}`);
        for (const raw of held) {
          const parsed = parseOutbox(raw);
          for (const row of parsed) {
            if (row.status === "completed") {
              continue;
            }
            outbox.set(row.externalId, row);
          }
        }
      }
      return true;
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }

  async loadOutboxById(externalId: string): Promise<readonly OutboxEntry[]> {
    if (z.string().min(1).safeParse(externalId).success === false) {
      return [];
    }
    try {
      const held = await this.driver.get(`o:${externalId}`);
      let rows: readonly OutboxEntry[] = [];
      for (const raw of held) {
        for (const row of parseOutbox(raw)) {
          rows = appendItem(rows, row);
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
    const nowMs = Date.parse(nowIso);
    if (Number.isFinite(nowMs) === false) {
      return [];
    }
    try {
      const ids = await this.driver.sMembers("oi");
      let claimed: readonly OutboxEntry[] = [];
      for (const externalId of ids) {
        if (claimed.length >= limit) {
          break;
        }
        const leaseHeld = await this.driver.get(`ol:${externalId}`);
        let leased = false;
        for (const until of leaseHeld) {
          const untilMs = Date.parse(until);
          if (Number.isFinite(untilMs) === true && untilMs > nowMs) {
            leased = true;
          }
        }
        if (leased === true) {
          continue;
        }
        const held = await this.driver.get(`o:${externalId}`);
        for (const raw of held) {
          for (const row of parseOutbox(raw)) {
            if (row.status !== "pending") {
              continue;
            }
            let due = true;
            for (const next of row.nextAttemptAt) {
              const nextMs = Date.parse(next);
              if (Number.isFinite(nextMs) === true && nextMs > nowMs) {
                due = false;
              }
            }
            if (due === false) {
              continue;
            }
            const leaseUntil = new Date(nowMs + 30_000).toISOString();
            await this.driver.set(`ol:${externalId}`, leaseUntil);
            claimed = appendItem(claimed, row);
          }
        }
      }
      return claimed;
    } catch (err) {
      this.failQuery(err);
      return [];
    }
  }

  async pruneSettledRuns(cutoffIso: string): Promise<readonly string[]> {
    try {
      const ids = await this.driver.sMembers("ri");
      let removed: readonly string[] = [];
      for (const runId of ids) {
        const held = await this.driver.get(`r:${runId}`);
        for (const raw of held) {
          const parsed = parseRun(raw);
          for (const runState of parsed) {
            if (runState.phase !== "completed" && runState.phase !== "compensated") {
              continue;
            }
            for (const updatedAt of runState.updatedAt) {
              if (updatedAt < cutoffIso) {
                await this.driver.del(`r:${runId}`);
                await this.driver.sRem("ri", runId);
                removed = appendItem(removed, runId);
              }
            }
          }
        }
      }
      return removed;
    } catch (err) {
      this.failQuery(err);
      return [];
    }
  }

  async queryRuns(query: RunQuery): Promise<readonly RunStateRow[]> {
    try {
      const ids = await this.driver.sMembers("ri");
      let rows: readonly RunStateRow[] = [];
      for (const runId of ids) {
        const held = await this.driver.get(`r:${runId}`);
        for (const raw of held) {
          const parsed = parseRun(raw);
          for (const runState of parsed) {
            if (query.phase.length > 0 && query.phase.includes(runState.phase) === false) {
              continue;
            }
            rows = appendItem(rows, runState);
          }
        }
      }
      const sorted = rows.toSorted((left, right) => compareRunOrder(left, right));
      return slicePage(sorted, query.limit, query.offset);
    } catch (err) {
      this.failQuery(err);
      throw DatabaseError.create(dbErrorMessageForLog(err, "database unavailable"));
    }
  }

  async queryOutbox(query: OutboxQuery): Promise<readonly OutboxEntry[]> {
    try {
      const ids = await this.driver.sMembers("oi");
      let rows: readonly OutboxEntry[] = [];
      for (const externalId of ids) {
        const held = await this.driver.get(`o:${externalId}`);
        for (const raw of held) {
          const parsed = parseOutbox(raw);
          for (const row of parsed) {
            if (query.status.length > 0 && query.status.includes(row.status) === false) {
              continue;
            }
            if (query.runId.length > 0 && query.runId.includes(row.runId) === false) {
              continue;
            }
            rows = appendItem(rows, row);
          }
        }
      }
      const sorted = rows.toSorted(compareOutboxOrder);
      return slicePage(sorted, query.limit, query.offset);
    } catch (err) {
      this.failQuery(err);
      throw DatabaseError.create(dbErrorMessageForLog(err, "database unavailable"));
    }
  }

  async saveRunState(runState: RunStateWrite): Promise<boolean> {
    try {
      const stamped: RunStateRow = {
        runId: runState.runId,
        model: runState.model,
        entityId: runState.entityId,
        operation: runState.operation,
        body: runState.body,
        filterJson: runState.filterJson,
        phase: runState.phase,
        pivotExternalId: runState.pivotExternalId,
        error: runState.error,
        updatedAt: [new Date().toISOString()],
      };
      await this.driver.set(`r:${runState.runId}`, JSON.stringify(stamped));
      await this.driver.sAdd("ri", runState.runId);
      return true;
    } catch (err) {
      return this.failQuery(err);
    }
  }

  async loadRunState(runId: string): Promise<readonly RunStateRow[]> {
    try {
      const held = await this.driver.get(`r:${runId}`);
      let rows: readonly RunStateRow[] = [];
      for (const raw of held) {
        const parsed = parseRun(raw);
        for (const runState of parsed) {
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
    const bounded = pageBound(limit);
    try {
      const ids = await this.driver.sMembers("ri");
      let rows: readonly RunStateRow[] = [];
      for (const runId of ids) {
        const held = await this.driver.get(`r:${runId}`);
        for (const raw of held) {
          const parsed = parseRun(raw);
          for (const runState of parsed) {
            if (runState.phase !== "forward" && runState.phase !== "compensating") {
              continue;
            }
            rows = appendItem(rows, runState);
          }
        }
      }
      const sorted = rows.toSorted((left, right) => compareRunOrder(right, left));
      return sorted.slice(0, bounded);
    } catch (err) {
      this.failQuery(err);
      return [];
    }
  }

  async announceOperation(): Promise<boolean> {
    return true;
  }
}
