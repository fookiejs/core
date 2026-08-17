import type { InjectablePool, PgClient } from "../../postgresql/src/pool.ts";
import { classify, unquoteIdents } from "./mock-sql.ts";
import type { Statement } from "./mock-sql.ts";
import {
  entityRowFromParams,
  outboxRowFromParams,
  runRowFromParams,
  textParam,
} from "./mock-rows.ts";
import type { Row } from "./mock-rows.ts";

export type { Cell, Row } from "./mock-rows.ts";

export const MockMode = {
  Ok: "ok",
  FailQuery: "fail-query",
  FailBegin: "fail-begin",
  FailCreateTable: "fail-create-table",
  FailOutboxSave: "fail-outbox-save",
  FailUpsert: "fail-upsert",
  FailSelect: "fail-select",
  FailConnect: "fail-connect",
} as const;

export type MockMode = (typeof MockMode)[keyof typeof MockMode];

type QueryResult = {
  rows: Row[];
  rowCount: number;
};

type MockStore = {
  tables: Set<string>;
  rows: Map<string, Map<string, Row>>;
  outbox: Map<string, Row>;
  runs: Map<string, Row>;
};

function emptyResult(): QueryResult {
  return { rows: [], rowCount: 0 };
}

function rowsResult(rows: readonly Row[]): QueryResult {
  return { rows: rows.slice(), rowCount: rows.length };
}

function entityIdOf(row: Row): string {
  const id = row.id;
  if (typeof id !== "string" || id.length < 1) {
    throw new Error("entity id required");
  }
  return id;
}

function tableRows(store: MockStore, table: string): Map<string, Row> {
  const existing = store.rows.get(table);
  if (existing !== undefined) {
    return existing;
  }
  const created = new Map<string, Row>();
  store.rows.set(table, created);
  return created;
}

function runPhases(statement: {
  phases: readonly string[];
  paramSlots: number;
}, params: readonly unknown[]): readonly string[] {
  if (statement.phases.length > 0) {
    return statement.phases;
  }
  const phases: string[] = [];
  for (let index = 0; index < statement.paramSlots; index += 1) {
    phases.push(textParam(params, index, "saga_phase"));
  }
  return phases;
}

function execute(store: MockStore, statement: Statement, params: readonly unknown[]): QueryResult {
  switch (statement.kind) {
    case "begin":
    case "commit":
    case "rollback":
    case "set":
    case "create-index":
    case "alter-table":
    case "noop":
      return emptyResult();
    case "create-table": {
      store.tables.add(statement.table);
      tableRows(store, statement.table);
      return emptyResult();
    }
    case "delete": {
      const key = textParam(params, 0, statement.key);
      if (statement.table === "fookie_outbox") {
        for (const [externalId, row] of [...store.outbox]) {
          if (row.run_id === key) {
            store.outbox.delete(externalId);
          }
        }
        return emptyResult();
      }
      if (statement.table === "fookie_run") {
        store.runs.delete(key);
        return emptyResult();
      }
      const removed = tableRows(store, statement.table).delete(key);
      return { rows: [], rowCount: removed ? 1 : 0 };
    }
    case "insert-run": {
      const row = runRowFromParams(params);
      const runId = row.run_id;
      if (typeof runId !== "string") {
        throw new Error("run_id required");
      }
      store.runs.set(runId, row);
      return { rows: [], rowCount: 1 };
    }
    case "insert-outbox": {
      const row = outboxRowFromParams(params, statement.outputBound);
      const externalId = row.external_id;
      if (typeof externalId !== "string") {
        throw new Error("external_id required");
      }
      store.outbox.set(externalId, row);
      return { rows: [], rowCount: 1 };
    }
    case "insert-entity": {
      const row = entityRowFromParams(statement.columns, params);
      tableRows(store, statement.table).set(entityIdOf(row), row);
      return { rows: [], rowCount: 1 };
    }
    case "select-run-by-id": {
      const runId = textParam(params, 0, "run_id");
      const row = store.runs.get(runId);
      if (row === undefined) {
        return emptyResult();
      }
      return rowsResult([row]);
    }
    case "select-run-list": {
      const wanted = runPhases(statement, params);
      const matched = [...store.runs.values()].filter((row) => {
        if (wanted.length < 1) {
          return true;
        }
        return typeof row.saga_phase === "string" && wanted.includes(row.saga_phase);
      });
      return rowsResult(matched);
    }
    case "select-outbox": {
      return rowsResult([...store.outbox.values()]);
    }
    case "select-outbox-by-id": {
      const externalId = textParam(params, 0, "external_id");
      const row = store.outbox.get(externalId);
      if (row === undefined) {
        return emptyResult();
      }
      return rowsResult([row]);
    }
    case "claim-outbox": {
      const nowIso = textParam(params, 2, "now");
      const nowMs = Date.parse(nowIso);
      const limitRaw = params[3];
      const limit = typeof limitRaw === "number" ? limitRaw : Number(limitRaw);
      let claimed: Row[] = [];
      for (const row of store.outbox.values()) {
        if (claimed.length >= limit) {
          break;
        }
        if (row.status !== "pending") {
          continue;
        }
        const next = row.next_attempt_at;
        if (typeof next === "string" && next.length > 0) {
          const dueMs = Date.parse(next);
          if (Number.isFinite(dueMs) === true && dueMs > nowMs) {
            continue;
          }
        }
        const leasedUntil = row.leased_until;
        if (typeof leasedUntil === "string" && leasedUntil.length > 0) {
          const leaseMs = Date.parse(leasedUntil);
          if (Number.isFinite(leaseMs) === true && leaseMs > nowMs) {
            continue;
          }
        }
        const externalId = row.external_id;
        if (typeof externalId !== "string") {
          continue;
        }
        const leased: Row = {
          ...row,
          leased_by: textParam(params, 0, "leased_by"),
          leased_until: textParam(params, 1, "leased_until"),
        };
        store.outbox.set(externalId, leased);
        claimed.push(leased);
      }
      return rowsResult(claimed);
    }
    case "select-entity-by-id": {
      const id = textParam(params, 0, "id");
      const row = tableRows(store, statement.table).get(id);
      if (row === undefined || row.is_deleted === true) {
        return emptyResult();
      }
      return rowsResult([row]);
    }
    case "select-entity-list": {
      const active = [...tableRows(store, statement.table).values()].filter(
        (row) => row.is_deleted !== true,
      );
      return rowsResult(active);
    }
  }
}

function throwCoded(sqlState: string | null): never {
  if (sqlState === null) {
    throw new Error("query");
  }
  const failure: Error & { code?: string } = new Error("deadlock detected");
  failure.code = sqlState;
  throw failure;
}

class MockClient implements PgClient {
  readonly pool: MockDb;

  constructor(pool: MockDb) {
    this.pool = pool;
  }

  query(sql: string, params?: unknown[]): Promise<QueryResult> {
    return this.pool.query(sql, params);
  }

  release(): boolean {
    return true;
  }
}

export class MockDb implements InjectablePool {
  tables = new Set<string>();
  rows = new Map<string, Map<string, Row>>();
  outbox = new Map<string, Row>();
  runs = new Map<string, Row>();
  mode: MockMode = MockMode.Ok;
  failOnSql: string | null = null;
  failCode: string | null = null;
  ddlDelayMs = 0;
  failBudget = -1;
  failRollback = false;
  queries: string[] = [];
  end: readonly (() => Promise<void>)[] = [];

  async query(rawSql: string, params: unknown[] = []): Promise<QueryResult> {
    const sql = unquoteIdents(rawSql);
    this.queries.push(sql);
    const statement = classify(sql);
    if (this.mode === MockMode.FailQuery) {
      throw new Error("query");
    }
    if (this.failOnSql !== null && sql.includes(this.failOnSql)) {
      if (this.failBudget === 0) {
        this.failOnSql = null;
      } else {
        if (this.failBudget > 0) {
          this.failBudget = this.failBudget - 1;
        }
        throwCoded(this.failCode);
      }
    }
    if (statement.kind === "begin" && this.mode === MockMode.FailBegin) {
      throw new Error("begin");
    }
    if (statement.kind === "rollback" && this.failRollback) {
      throw new Error("rollback");
    }
    if (statement.kind === "create-table" && this.ddlDelayMs > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, this.ddlDelayMs);
      });
    }
    if (statement.kind === "create-table" && this.mode === MockMode.FailCreateTable) {
      throw new Error("create");
    }
    if (statement.kind === "insert-outbox" && this.mode === MockMode.FailOutboxSave) {
      throw new Error("outbox");
    }
    if (statement.kind === "insert-entity" && this.mode === MockMode.FailUpsert) {
      throw new Error("upsert");
    }
    if (
      (statement.kind === "select-entity-by-id" || statement.kind === "select-entity-list") &&
      this.mode === MockMode.FailSelect
    ) {
      throw new Error("select");
    }
    return execute(
      { tables: this.tables, rows: this.rows, outbox: this.outbox, runs: this.runs },
      statement,
      params,
    );
  }

  async connect(): Promise<PgClient> {
    if (this.mode === MockMode.FailConnect) {
      throw new Error("connect");
    }
    return new MockClient(this);
  }
}
