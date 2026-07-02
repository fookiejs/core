import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app, Model, External, Types, Done, flows } from "../src/index.ts";
import {
  MockDb,
  httpPost,
  httpRaw,
  httpTruncateBody,
  httpSocketDrop,
  trackApp,
  shutdownLiveApps,
} from "./mock-db.ts";

let nextPort = 47000;

const scoreExt = External({
  name: "fraud.score",
  input: { amount: Types.currency },
  output: { score: Types.int },
  attempts: 1,
  backoff: "fixed",
});

describe("http edge routes", () => {
  let db: MockDb;
  let port: number;

  beforeEach(() => {
    db = new MockDb();
    port = nextPort;
    nextPort += 10;
  });

  afterEach(async () => {
    await shutdownLiveApps();
  });

  it("covers 404 paths and external payload branches", async () => {
    const user = Model({
      name: "EdgeRoute",
      fields: { email: Types.email, loc: Types.coordinate },
      flow: flows({
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
      }),
    });

    const fookie = trackApp(app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    }));
    fookie.run();

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
    assert.equal(badExt.status, 400);
    assert.equal(badExt.json.ok, false);

    const unknownAction = await httpPost(port, "/edgeroute/id/unknown", { filter: {} });
    assert.equal(unknownAction.status, 404);
  });

  it("covers filter operator parsing branches over http", async () => {
    const user = Model({
      name: "FilterEdge",
      fields: { email: Types.email, score: Types.int },
      flow: flows({
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
      }),
    });

    const fookie = trackApp(app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    }));
    fookie.run();

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
      fields: { email: Types.email, loc: Types.coordinate },
      flow: flows({
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
      }),
    });

    const fookie = trackApp(app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    }));
    fookie.run();

    const created = await httpPost(port, "/mutate/create", {
      body: { email: "m@t.com", loc: [1, 2] },
    });
    const id = readEntityId(created.json);

    const updated = await httpPost(port, `/mutate/${id}/update`, {
      body: { loc: [3, 4] },
      filter: { email: { eq: "m@t.com" } },
    });
    assert.equal(updated.json.signal, "done");

    const deleted = await httpPost(port, `/mutate/${id}/delete`, {
      filter: { email: { eq: "m@t.com" } },
    });
    assert.equal(deleted.json.signal, "done");

    const badUpdate = await httpPost(port, `/mutate/${id}/update`, {
      body: { email: "not-email" },
      filter: { email: { eq: 1 } },
    });
    assert.equal(badUpdate.status, 400);

    const throwStatus = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: "/mutate/list",
          method: "POST",
          headers: { "x-fookie-test-throw": "1" },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", reject);
      req.end();
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
      fields: { email: Types.email, score: Types.int },
      flow: flows({
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
      }),
    });

    const fookie = trackApp(app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    }));
    fookie.run();

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
      fields: { email: Types.email, loc: Types.coordinate },
      flow: flows({
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
      }),
    });

    const fookie = trackApp(app({
      listen: String(port),
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    }));
    fookie.run();

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
    assert.equal(nearTwo.status, 200);

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
  if (entity && typeof entity === "object" && !Array.isArray(entity) && "id" in entity) {
    const id = entity.id;
    if (typeof id === "string") {
      return id;
    }
  }
  return "";
}
