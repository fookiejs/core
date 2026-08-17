import type { OutboxEntry } from "../engine/outbox.ts";
import type { FilterState, ListPage } from "../filter/ops.ts";
import type { ModelDef, ModelFieldsInput } from "../model.ts";
import type { DbErrorBox, PgParam, PgRow } from "../pg/encode.ts";
import type { Database } from "./database.ts";
import type { EntityRecord } from "../values.ts";
import type { LockMode, OutboxQuery, RunQuery } from "./query.ts";
import type { RunStateRow, RunStateWrite } from "./rows.ts";
import type { OperationEvent } from "../settled.ts";

export type StoreSession = {
  store: EntityStore;
  begin(): Promise<boolean>;
  commit(): Promise<boolean>;
  rollback(): Promise<boolean>;
  setLockTimeout(timeoutMs: number): Promise<boolean>;
  beginReadSnapshot(): Promise<boolean>;
  release(): void;
};

export type EnsureTablesOptions = {
  control: boolean;
};

export type EntityStore = {
  connectSession(): Promise<StoreSession>;
  lastSqlState(): readonly string[];
  selectRows(sql: string, params: readonly PgParam[]): Promise<readonly PgRow[]>;
  applyDdlLockTimeout(timeoutMs: number): Promise<boolean>;
  removeEntityRow(
    models: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    modelName: string,
    entityId: string,
  ): Promise<boolean>;
  ensureAllTables(
    modelsOnStore: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    allModels: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    fallbackDatabase: Database,
    errorBox: DbErrorBox,
    options: EnsureTablesOptions,
  ): Promise<boolean>;
  upsertEntity(model: ModelDef<ModelFieldsInput>, entity: EntityRecord): Promise<boolean>;
  loadEntity(
    model: ModelDef<ModelFieldsInput>,
    entityId: string,
    lock: readonly LockMode[],
  ): Promise<EntityRecord>;
  queryEntities(
    model: ModelDef<ModelFieldsInput>,
    filter: FilterState,
    page: ListPage,
  ): Promise<EntityRecord[]>;
  saveOutboxEntry(outboxRow: OutboxEntry): Promise<boolean>;
  loadOutbox(outbox: Map<string, OutboxEntry>, errorBox: DbErrorBox): Promise<boolean>;
  loadOutboxById(externalId: string): Promise<readonly OutboxEntry[]>;
  claimDueOutbox(workerId: string, nowIso: string, limit: number): Promise<readonly OutboxEntry[]>;
  pruneSettledRuns(cutoffIso: string): Promise<readonly string[]>;
  queryRuns(query: RunQuery): Promise<readonly RunStateRow[]>;
  queryOutbox(query: OutboxQuery): Promise<readonly OutboxEntry[]>;
  saveRunState(runState: RunStateWrite): Promise<boolean>;
  loadRunState(runId: string): Promise<readonly RunStateRow[]>;
  loadResumableRuns(limit: number): Promise<readonly RunStateRow[]>;
  announceOperation(event: OperationEvent): Promise<boolean>;
};
