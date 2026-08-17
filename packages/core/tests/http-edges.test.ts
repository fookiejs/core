import { z } from "zod";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { Done, External, Model, Types, app } from "../src/index.ts";
import {
  MockDb,
  httpPost,
  httpRaw,
  httpTruncateBody,
  httpSocketDrop,
  LiveApps,
  serveApp,
} from "./mock-db.ts";
import { Postgres } from "./engines.ts";

let nextPort = 47000;

const scoreExt = External({
  name: "fraud.score",
  input: { amount: z.number().finite().nonnegative() },
  output: { score: z.number().int() },
  attempts: 1,
  backoff: "fixed",
  timeoutMs: 30_000,
});

describe("http edge routes", () => {
  let db: MockDb;
  let apps: LiveApps;
  let port: number;

  beforeEach(() => {
    db = new MockDb();
    apps = new LiveApps();
    port = nextPort;
    nextPort += 10;
  });

  afterEach(async () => {
    await apps.shutdown();
  });

  it("covers 404 paths and external payload branches", async () => {
    const user = Model({
      name: "EdgeRoute",
      fields: { email: z.string().email(), loc: Types.coordinate },
      flow: {
        async create() {
          return Done;
        },
        async list() {
          return Done;
        },
        async update() {
          return Done;
        },
        async delete() {
          return Done;
        },
      },
    });

    const fookie = apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [user],
        externals: [scoreExt] as const,
        onExternalEvent: async () => {},
      }),
    );
    await serveApp(fookie);

    const root = await httpPost(port, "/only", {});
    assert.equal(root.status, 404);

    const missing = await httpPost(port, "/missingmodel/create", {
      body: { email: "a@b.com", loc: [0, 0] },
    });
    assert.equal(missing.status, 404);

    const short = await httpPost(port, "/edgeroute/entity-only", { filter: {} });
    assert.equal(short.status, 404);

    const badExt = await httpPost(port, "/external/result", {
      externalId: 99,
      output: { score: 1 },
    });
    assert.equal(badExt.status, 404);

    const unknownAction = await httpPost(port, "/edgeroute/id/unknown", { filter: {} });
    assert.equal(unknownAction.status, 404);
  });

  it("covers filter operator parsing branches over http", async () => {
    const user = Model({
      name: "FilterEdge",
      fields: { email: z.string().email(), score: z.number().int() },
      flow: {
        async create() {
          return Done;
        },
        async list() {
          return Done;
        },
        async update() {
          return Done;
        },
        async delete() {
          return Done;
        },
      },
    });

    const fookie = apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [user],
        externals: [scoreExt] as const,
        onExternalEvent: async () => {},
      }),
    );
    await serveApp(fookie);

    await httpPost(port, "/filteredge/create", {
      body: { email: "f@e.com", score: 1 },
    });

    const res = await httpPost(port, "/filteredge/list", {
      filter: {
        email: { eq: "f@e.com", ne: "x@y.com" },
        score: { gt: 0, lt: 10 },
      },
    });
    assert.equal(res.status, 200);

    await httpPost(port, "/filteredge/list", {
      filter: { email: { eq: "f@e.com", in: [1, 2, 3] } },
    });

    const emptyIn = await httpPost(port, "/filteredge/list", {
      filter: { email: { in: [1, 2, 3] } },
    });
    assert.equal(emptyIn.status, 400);
  });

  it("covers http update delete and invalid bodies", async () => {
    const user = Model({
      name: "Mutate",
      fields: { email: z.string().email(), loc: Types.coordinate },
      flow: {
        async create() {
          return Done;
        },
        async list() {
          return Done;
        },
        async update() {
          return Done;
        },
        async delete() {
          return Done;
        },
      },
    });

    const fookie = apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [user],
        externals: [scoreExt] as const,
        onExternalEvent: async () => {},
      }),
    );
    await serveApp(fookie);

    const created = await httpPost(port, "/mutate/create", {
      body: { email: "m@t.com", loc: [1, 2] },
    });
    const id = readEntityId(created.json);

    const updated = await httpPost(port, "/mutate/update", {
      body: { loc: [3, 4] },
      filter: { email: { eq: "m@t.com" } },
    });
    assert.equal(updated.json.signal, "done");

    const deleted = await httpPost(port, `/mutate/${id}/delete`, {
      filter: { email: { eq: "m@t.com" } },
    });
    assert.equal(deleted.json.signal, "done");

    const badUpdate = await httpPost(port, "/mutate/update", {
      body: { email: "not-email" },
      filter: { email: { eq: 1 } },
    });
    assert.equal(badUpdate.status, 400);

    const throwStatus = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "//[",
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", reject);
      req.end("{}");
    });
    assert.equal(throwStatus, 500);

    const truncated = await httpTruncateBody(port, "/mutate/list");
    assert.equal(truncated, 400);

    const badJson = await httpRaw(port, "/mutate/list", "not-json");
    assert.equal(badJson.status, 400);
  });

  it("covers filter field parsing and request payload filtering", async () => {
    const user = Model({
      name: "ParseEdge",
      fields: { email: z.string().email(), score: z.number().int() },
      flow: {
        async create() {
          return Done;
        },
        async list() {
          return Done;
        },
        async update() {
          return Done;
        },
        async delete() {
          return Done;
        },
      },
    });

    const fookie = apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [user],
        externals: [scoreExt] as const,
        onExternalEvent: async () => {},
      }),
    );
    await serveApp(fookie);

    const created = await httpRaw(
      port,
      "/parseedge/create",
      JSON.stringify({
        body: { email: "p@e.com", score: 2 },
        ignored: [1, 2, 3],
      }),
    );
    assert.equal(created.status, 200);

    const filtered = await httpRaw(
      port,
      "/parseedge/list",
      JSON.stringify({
        filter: {
          email: { in: [1, {}, "p@e.com"], eq: {}, ne: [] },
          score: { gt: true, gte: false },
          bad: [1, 2],
        },
      }),
    );
    assert.equal(filtered.status, 400);

    const dropped = await httpSocketDrop(port, "/parseedge/list");
    assert.equal(dropped, 400);
  });

  it("covers extended http filter operators", async () => {
    const user = Model({
      name: "FilterOps",
      fields: { email: z.string().email(), loc: Types.coordinate },
      flow: {
        async create() {
          return Done;
        },
        async list() {
          return Done;
        },
        async update() {
          return Done;
        },
        async delete() {
          return Done;
        },
      },
    });

    const fookie = apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [user],
        externals: [scoreExt] as const,
        onExternalEvent: async () => {},
      }),
    );
    await serveApp(fookie);

    await httpPost(port, "/filterops/create", {
      body: { email: "f@ops.com", loc: [10, 20] },
    });

    const listed = await httpPost(port, "/filterops/list", {
      filter: {
        email: { startsWith: "f@", endsWith: ".com", like: "%ops%", ilike: "%OPS%" },
        loc: { near: [10, 20, 500] },
      },
    });
    assert.equal(listed.status, 200);

    const nearTwo = await httpPost(port, "/filterops/list", {
      filter: { loc: { near: [10, 20] } },
    });
    assert.equal(nearTwo.status, 400);

    const invalidLike = await httpRaw(
      port,
      "/filterops/list",
      JSON.stringify({ filter: { email: { like: 1, startsWith: 1, endsWith: false } } }),
    );
    assert.equal(invalidLike.status, 400);

    const invalidNear = await httpRaw(
      port,
      "/filterops/list",
      JSON.stringify({ filter: { loc: { near: ["a", "b"] } } }),
    );
    assert.equal(invalidNear.status, 400);

    const arrayBody = await httpRaw(port, "/filterops/list", "[]");
    assert.equal(arrayBody.status, 400);
  });
});

function readEntityId(json: Record<string, unknown>): string {
  const entity = json.entity;
  if (
    entity !== undefined &&
    entity !== null &&
    typeof entity === "object" &&
    Array.isArray(entity) === false &&
    "id" in entity
  ) {
    const id = entity.id;
    if (typeof id === "string") {
      return id;
    }
  }
  return "";
}
