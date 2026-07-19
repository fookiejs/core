import http from "node:http";
import net from "node:net";
import type { App, InjectablePool } from "../src/index.ts";

export type Row = Record<string, string | number | boolean | null>;

export class MockDb implements InjectablePool {
  tables = new Set<string>();
  rows = new Map<string, Map<string, Row>>();
  outbox = new Map<string, Row>();
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
      if (match?.[1]) {
        this.tables.add(match[1]);
        if (!this.rows.has(match[1])) {
          this.rows.set(match[1], new Map());
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
    if (sql.includes("fookie_outbox") && sql.startsWith("SELECT")) {
      return { rows: [...this.outbox.values()], rowCount: this.outbox.size };
    }
    if (sql.includes("fookie_outbox") && sql.startsWith("INSERT")) {
      if (this.mode === "fail-outbox-save") {
        throw new Error("outbox");
      }
      const externalId = String(params?.[0] ?? "");
      if (sql.includes("NULL::jsonb")) {
        this.outbox.set(externalId, {
          external_id: externalId,
          name: String(params?.[1] ?? ""),
          status: String(params?.[2] ?? ""),
          input: JSON.parse(String(params?.[3] ?? "{}")),
          output: null,
          entity_id: String(params?.[4] ?? ""),
          model: String(params?.[5] ?? ""),
          run_id: String(params?.[6] ?? ""),
          attempt: typeof params?.[7] === "number" ? params[7] : 1,
        });
        return { rows: [], rowCount: 1 };
      }
      this.outbox.set(externalId, {
        external_id: externalId,
        name: String(params?.[1] ?? ""),
        status: String(params?.[2] ?? ""),
        input: JSON.parse(String(params?.[3] ?? "{}")),
        output: params?.[4] ? JSON.parse(String(params?.[4])) : null,
        entity_id: String(params?.[5] ?? ""),
        model: String(params?.[6] ?? ""),
        run_id: String(params?.[7] ?? ""),
        attempt: typeof params?.[8] === "number" ? params[8] : 1,
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
