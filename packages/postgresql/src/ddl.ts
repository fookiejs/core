import { z } from "zod";
import { isRelationField, isSystemFieldKey } from "@fookiejs/core";
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
} from "@fookiejs/core";
import { appendItem } from "@fookiejs/core";
import type { ModelDef, ModelFieldsInput } from "@fookiejs/core";
import type { FieldValue } from "@fookiejs/core";
import type { Database } from "@fookiejs/core";
import { modelDatabaseOf, storeKindOf } from "@fookiejs/core";

function columnDefinition(key: string, field: FieldValue): string {
  const col = quotedColumnFor(key);
  const type = pgColumnType(field);
  if (key === "isDeleted") {
    return `${col} ${type} NOT NULL DEFAULT false`;
  }
  if (key === "createdAt" || key === "updatedAt") {
    return `${col} ${type} NOT NULL DEFAULT NOW()`;
  }
  if (isSystemFieldKey(key)) {
    return `${col} ${type} NOT NULL`;
  }
  return `${col} ${type}`;
}

function addColumnStatement(qualified: string, key: string, field: FieldValue): string {
  const col = quotedColumnFor(key);
  const type = pgColumnType(field);
  const head = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS ${col} ${type}`;
  if (key === "isDeleted") {
    return `${head} NOT NULL DEFAULT false`;
  }
  if (key === "createdAt" || key === "updatedAt") {
    return `${head} NOT NULL DEFAULT NOW()`;
  }
  return head;
}

function indexStatements(
  table: string,
  qualified: string,
  key: string,
  field: FieldValue,
): string[] {
  const col = quotedColumnFor(key);
  const indexName = quoteIdent(`${table}_${columnNameFor(key)}_idx`);
  const uniqueName = quoteIdent(`${table}_${columnNameFor(key)}_uidx`);
  if (isRelationField(field)) {
    return [`CREATE INDEX IF NOT EXISTS ${indexName} ON ${qualified} (${col})`];
  }
  if (field.meta.unique) {
    return [`CREATE UNIQUE INDEX IF NOT EXISTS ${uniqueName} ON ${qualified} (${col})`];
  }
  if (field.meta.index && field.meta.unique === false) {
    return [`CREATE INDEX IF NOT EXISTS ${indexName} ON ${qualified} (${col})`];
  }
  return [];
}

export function modelTableStatements(model: ModelDef<ModelFieldsInput>): readonly string[] {
  const table = tableNameFor(model.name);
  const qualified = quotedTableFor(model.name);
  let columns: readonly string[] = [];
  for (const [key, field] of Object.entries(model.fields)) {
    columns = appendItem(columns, columnDefinition(key, field));
  }
  let statements: readonly string[] = [
    `CREATE TABLE IF NOT EXISTS ${qualified} (${columns.join(", ")}, PRIMARY KEY (id))`,
  ];
  for (const [key, field] of Object.entries(model.fields)) {
    statements = appendItem(statements, addColumnStatement(qualified, key, field));
    for (const statement of indexStatements(table, qualified, key, field)) {
      statements = appendItem(statements, statement);
    }
  }
  return statements;
}

function modelNamed(
  models: ReadonlyArray<ModelDef<ModelFieldsInput>>,
  name: string,
): readonly ModelDef<ModelFieldsInput>[] {
  if (z.string().min(1).safeParse(name).success === false) {
    return [];
  }
  if (Array.isArray(models) === false) {
    return [];
  }
  for (const model of models) {
    if (model.name === name) {
      return [model];
    }
  }
  return [];
}

export function modelForeignKeyStatements(
  model: ModelDef<ModelFieldsInput>,
  peers: ReadonlyArray<ModelDef<ModelFieldsInput>>,
  fallbackDatabase: Database,
): readonly string[] {
  const source = modelDatabaseOf(model, fallbackDatabase);
  if (storeKindOf(source) !== "postgres") {
    return [];
  }
  const table = tableNameFor(model.name);
  const qualified = quotedTableFor(model.name);
  let statements: readonly string[] = [];
  for (const [key, field] of Object.entries(model.fields)) {
    for (const targetName of relationTargetOf(field)) {
      const targets = modelNamed(peers, targetName);
      if (targets.length < 1) {
        continue;
      }
      for (const target of targets) {
        const targetEngine = modelDatabaseOf(target, fallbackDatabase);
        if (targetEngine.key !== source.key) {
          continue;
        }
        if (storeKindOf(targetEngine) !== "postgres") {
          continue;
        }
        const col = quotedColumnFor(key);
        const referenced = quotedTableFor(target.name);
        const name = quoteIdent(`${table}_${columnNameFor(key)}_fk`);
        statements = appendItem(
          statements,
          `DO $$ BEGIN
    ALTER TABLE ${qualified} ADD CONSTRAINT ${name}
      FOREIGN KEY (${col}) REFERENCES ${referenced} (id)
      ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
  EXCEPTION WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  END $$;`,
        );
      }
    }
  }
  return statements;
}

export function outboxTableStatements(): readonly string[] {
  return [
    `CREATE TABLE IF NOT EXISTS ${outboxTableName} (
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
    dispatched_at TIMESTAMPTZ,
    leased_by TEXT,
    leased_until TIMESTAMPTZ
  )`,
    `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS step_index INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS step TEXT NOT NULL DEFAULT 'compensatable'`,
    `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ`,
    `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS error TEXT`,
    `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS compensation_of TEXT`,
    `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ`,
    `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS leased_by TEXT`,
    `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS leased_until TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS fookie_outbox_due_idx ON ${outboxTableName} (status, next_attempt_at)`,
    `CREATE INDEX IF NOT EXISTS fookie_outbox_run_idx ON ${outboxTableName} (run_id, step_index)`,
    `CREATE INDEX IF NOT EXISTS fookie_outbox_lease_idx ON ${outboxTableName} (status, leased_until)`,
  ];
}

export function runTableStatements(): readonly string[] {
  return [
    `CREATE TABLE IF NOT EXISTS ${runTableName} (
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
  )`,
    `ALTER TABLE ${runTableName} ADD COLUMN IF NOT EXISTS saga_phase TEXT NOT NULL DEFAULT 'forward'`,
    `ALTER TABLE ${runTableName} ADD COLUMN IF NOT EXISTS pivot_external_id TEXT`,
    `ALTER TABLE ${runTableName} ADD COLUMN IF NOT EXISTS error TEXT`,
    `ALTER TABLE ${runTableName} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `CREATE INDEX IF NOT EXISTS fookie_run_phase_idx ON ${runTableName} (saga_phase)`,
  ];
}

export const schemaVersion = 1;

export function schemaVersionStatements(): readonly string[] {
  return [
    `CREATE TABLE IF NOT EXISTS public.fookie_schema (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
    `INSERT INTO public.fookie_schema (version) VALUES (${String(schemaVersion)}) ON CONFLICT (version) DO NOTHING`,
  ];
}
