import http from "node:http";
import net from "node:net";
import type { App, InjectablePool } from "../src/index.ts";

function nullIfAbsent(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const text = String(raw);
  if (text.length === 0 || text === "__fookie_absent__") {
    return null;
  }
  return text;
}

function outboxOutput(raw: unknown): Row[string] {
  if (raw === undefined || raw === null) {
    return null;
  }
  return JSON.parse(String(raw));
}

export type Row = Record<string, string | number | boolean | null>;

export class MockDb implements InjectablePool {
  tables = new Set<string>();
  rows = new Map<string, Map<string, Row>>();
  outbox = new Map<string, Row>();
  runs = new Map<string, Row>();
  mode = "ok";
  failOnSql = "";
  failRollback = false;
  queries: string[] = [];
  end: readonly (() => Promise<void>)[] = [];

  async query(sql: string, params?: unknown[]) {
    this.queries.push(sql);
    if (this.mode === "fail-query") {
      throw new Error("query");
    }
    if (this.failOnSql.length > 0 && sql.includes(this.failOnSql)) {
      throw new Error("query");
    }
    if (sql === "BEGIN") {
      if (this.mode === "fail-begin") {
        throw new Error("begin");
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql === "ROLLBACK" && this.failRollback) {
      throw new Error("rollback");
    }
    if (sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith("CREATE TABLE")) {
      if (this.mode === "fail-create-table") {
        throw new Error("create");
      }
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (?:public\.)?(\w+)/);
      const table = match === null ? "" : (match[1] ?? "");
      if (table.length > 0) {
        this.tables.add(table);
        if (this.rows.has(table) === false) {
          this.rows.set(table, new Map());
        }
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith("CREATE UNIQUE INDEX") || sql.startsWith("CREATE INDEX")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith("ALTER TABLE")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith("DELETE FROM")) {
      const runId = String(params?.[0] ?? "");
      if (sql.includes("fookie_outbox")) {
        for (const [key, row] of [...this.outbox]) {
          if (row.run_id === runId) {
            this.outbox.delete(key);
          }
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("fookie_run")) {
        this.runs.delete(runId);
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (
      sql.includes("fookie_outbox") === false &&
      sql.includes("fookie_run") &&
      sql.startsWith("SELECT")
    ) {
      if (sql.includes("WHERE run_id = $1")) {
        const runId = String(params?.[0] ?? "");
        const row = this.runs.get(runId);
        if (row === undefined) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [row], rowCount: 1 };
      }
      const phases = sql.match(/saga_phase IN \(([^)]+)\)/);
      if (phases === null) {
        return { rows: [], rowCount: 0 };
      }
      const wanted = (phases[1] ?? "").split(",").map((part) => part.trim().replace(/'/g, ""));
      const matched = [...this.runs.values()].filter((row) =>
        wanted.includes(String(row.saga_phase ?? "")),
      );
      return { rows: matched, rowCount: matched.length };
    }
    if (
      sql.includes("fookie_outbox") === false &&
      sql.includes("fookie_run") &&
      sql.startsWith("INSERT")
    ) {
      const runId = String(params?.[0] ?? "");
      this.runs.set(runId, {
        run_id: runId,
        model: String(params?.[1] ?? ""),
        entity_id: String(params?.[2] ?? ""),
        operation: String(params?.[3] ?? ""),
        body: JSON.parse(String(params?.[4] ?? "{}")),
        filter: String(params?.[5] ?? "[]"),
        saga_phase: String(params?.[6] ?? "forward"),
        pivot_external_id: nullIfAbsent(params?.[7]),
        error: nullIfAbsent(params?.[8]),
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("fookie_outbox") && sql.startsWith("SELECT")) {
      return { rows: [...this.outbox.values()], rowCount: this.outbox.size };
    }
    if (sql.includes("fookie_outbox") && sql.startsWith("INSERT")) {
      if (this.mode === "fail-outbox-save") {
        throw new Error("outbox");
      }
      const externalId = String(params?.[0] ?? "");
      const shift = sql.includes("NULL::jsonb") ? 1 : 0;
      const attemptRaw = params?.[8 - shift];
      const stepIndexRaw = params?.[9 - shift];
      this.outbox.set(externalId, {
        external_id: externalId,
        name: String(params?.[1] ?? ""),
        status: String(params?.[2] ?? ""),
        input: JSON.parse(String(params?.[3] ?? "{}")),
        output: shift === 1 ? null : outboxOutput(params?.[4]),
        entity_id: String(params?.[5 - shift] ?? ""),
        model: String(params?.[6 - shift] ?? ""),
        run_id: String(params?.[7 - shift] ?? ""),
        attempt: typeof attemptRaw === "number" ? attemptRaw : 1,
        step_index: typeof stepIndexRaw === "number" ? stepIndexRaw : 0,
        step: String(params?.[10 - shift] ?? "compensatable"),
        next_attempt_at: nullIfAbsent(params?.[11 - shift]),
        error: nullIfAbsent(params?.[12 - shift]),
        compensation_of: nullIfAbsent(params?.[13 - shift]),
        dispatched_at: nullIfAbsent(params?.[14 - shift]),
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("INSERT INTO")) {
      if (this.mode === "fail-upsert") {
        throw new Error("upsert");
      }
      const tableMatch = sql.match(/INSERT INTO (?:public\.)?(\w+)/);
      const colsMatch = sql.match(/\(([^)]+)\) VALUES/);
      const table = tableMatch?.[1] ?? "unknown";
      const cols = colsMatch?.[1]?.split(",").map((c) => c.trim()) ?? [];
      const row: Row = {};
      for (let i = 0; i < cols.length; i += 1) {
        const col = cols[i] ?? "";
        const val = params?.[i];
        if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
          row[col] = val;
        }
      }
      const id = String(row.id ?? "");
      if (!this.rows.has(table)) {
        this.rows.set(table, new Map());
      }
      this.rows.get(table)?.set(id, row);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT * FROM")) {
      if (this.mode === "fail-select") {
        throw new Error("select");
      }
      const tableMatch = sql.match(/SELECT \* FROM (?:public\.)?(\w+)/);
      const table = tableMatch?.[1] ?? "";
      const tableRows = this.rows.get(table);
      if (!tableRows) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("WHERE id = $1")) {
        const id = String(params?.[0] ?? "");
        const row = tableRows.get(id);
        if (!row || row.is_deleted === true) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [row], rowCount: 1 };
      }
      const active = [...tableRows.values()].filter((row) => row.is_deleted !== true);
      return { rows: active, rowCount: active.length };
    }
    return { rows: [], rowCount: 0 };
  }

  async connect() {
    if (this.mode === "fail-connect") {
      throw new Error("connect");
    }
    const self = this;
    return {
      query: (s: string, p?: unknown[]) => self.query(s, p),
      release: () => true,
    };
  }
}

export function httpPost(port: number, path: string, body: Record<string, unknown>) {
  return new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            json: JSON.parse(Buffer.concat(chunks).toString("utf8")),
          }),
        );
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

export function httpSocketDrop(port: number, path: string) {
  return new Promise<number>((resolve) => {
    const client = net.connect({ port, host: "127.0.0.1" }, () => {
      client.write(
        `POST ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 32\r\n\r\n{"filter":{"email":{"eq":"x"}}}`,
      );
      client.destroy();
    });
    client.on("error", () => resolve(400));
    setTimeout(() => resolve(400), 100);
  });
}

export function httpTruncateBody(port: number, path: string) {
  return new Promise<number>((resolve) => {
    const client = net.connect({ port, host: "127.0.0.1" }, () => {
      client.write(
        `POST ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 64\r\n\r\n{"filter":`,
      );
      setTimeout(() => client.destroy(), 20);
    });
    client.on("error", () => resolve(400));
    setTimeout(() => resolve(400), 250);
  });
}

export function httpAbort(port: number, path: string) {
  return new Promise<number>((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on("error", () => resolve(400));
    req.write("{");
    req.destroy();
  });
}

export function httpGet(port: number, path: string) {
  return new Promise<number>((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path, method: "GET" }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();
  });
}

export function httpRaw(
  port: number,
  path: string,
  payload: string,
  headers: Record<string, string> = {},
) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

const liveApps = new Set<App>();

export function trackApp<T extends App>(instance: T): T {
  liveApps.add(instance);
  return instance;
}

export async function shutdownLiveApps(): Promise<void> {
  await Promise.all([...liveApps].map((instance) => instance.stop()));
  liveApps.clear();
}
