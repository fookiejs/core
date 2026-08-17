import { z } from "zod";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { Done, Model, app } from "@fookiejs/core";
import { Method, realtime } from "@fookiejs/realtime";
import { Postgres } from "../../postgresql/src/index.ts";
import { graphqlServer } from "../src/server.ts";
import type { GraphqlServerOptions } from "../src/server.ts";
import { ensureTestPostgres } from "../../core/tests/postgres-env.ts";

const databaseUrl = await ensureTestPostgres();

const ticket = Model({
  name: "SubTicket",
  fields: { subject: z.string(), tenant: z.string() },
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

async function readFrames(url: string, until: number, signal: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal });
  assert.equal(response.status, 200);
  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new Error("stream has no body");
  }
  const decoder = new TextDecoder();
  let text = "";
  while (text.split("event: next").length - 1 < until) {
    const chunk = await reader.read();
    if (chunk.done === true) {
      break;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text;
}

const idleGraph: GraphqlServerOptions = {
  port: [],
  limits: [],
  snapshot: true,
  budget: [],
  realtime: [],
};

describe("subscriptions over sse", () => {
  let pool: pg.Pool;

  before(() => {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 8 });
  });

  after(async () => {
    await pool.end();
  });

  function boot() {
    return app({
      listen: "0",
      database: Postgres(databaseUrl, [
        {
          query: (sql: string, params?: unknown[]) => pool.query(sql, params),
          connect: () => pool.connect(),
          end: [],
        },
      ]),
      models: [ticket],
      externals: [] as const,
      onExternalEvent: async () => {},
    });
  }

  function liveOf() {
    return realtime(
      [
        {
          model: ticket,
          method: Method.UPDATE,
          who(clientIds) {
            return clientIds.filter((id) => id === "watch");
          },
        },
      ],
      {
        listen: [],
        bus: [],
        batch: [],
      },
    );
  }

  it("streams an update to a client that who returns", async () => {
    const fookie = boot();
    const live = liveOf();
    const server = graphqlServer(fookie, {
      port: ["24781"],
      limits: [],
      snapshot: true,
      budget: [],
      realtime: [live],
    });
    server.watch(fookie);

    const made = await fookie.create(ticket, { subject: "help", tenant: "acme" });
    assert.equal(made.signal, "done");

    const abort = new AbortController();
    const frames = readFrames(`http://127.0.0.1:24781/stream?client=watch`, 1, abort.signal);
    await new Promise((resolve) => setTimeout(resolve, 150));

    const changed = await fookie.update(ticket, { id: { eq: made.id } }, { subject: "later" });
    assert.equal(changed.signal, "done");

    const text = await frames;
    assert.match(text, /event: next/);
    assert.match(text, /"model":"SubTicket"/);
    assert.match(text, /"operation":"update"/);
    assert.match(text, /"signal":"DONE"/);
    assert.equal(text.includes("help"), false, "the subject never crosses the wire");
    assert.equal(text.includes("later"), false, "the new subject never crosses the wire");

    abort.abort();
    await live.stop();
    await server.stop();
    await fookie.stop();
  });

  it("does not stream to a client that who does not return", async () => {
    const fookie = boot();
    const live = liveOf();
    const server = graphqlServer(fookie, {
      port: ["24782"],
      limits: [],
      snapshot: true,
      budget: [],
      realtime: [live],
    });
    server.watch(fookie);

    const first = await fookie.create(ticket, { subject: "one", tenant: "acme" });
    assert.equal(first.signal, "done");

    const abort = new AbortController();
    const response = await fetch(`http://127.0.0.1:24782/stream?client=other`, {
      signal: abort.signal,
    });
    assert.equal(response.status, 200);

    const reader = response.body?.getReader();
    if (reader === undefined) {
      throw new Error("stream has no body");
    }
    const decoder = new TextDecoder();
    let text = "";
    await fookie.update(ticket, { id: { eq: first.id } }, { subject: "changed" });
    const until = Date.now() + 250;
    while (Date.now() < until) {
      const remain = until - Date.now();
      const chunk = await Promise.race([
        reader.read(),
        new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), remain)),
      ]);
      if (chunk === undefined || chunk.done === true) {
        break;
      }
      if (chunk.value !== undefined) {
        text += decoder.decode(chunk.value, { stream: true });
      }
    }
    assert.equal(text.includes("event: next"), false);

    abort.abort();
    await live.stop();
    await server.stop();
    await fookie.stop();
  });

  it("refuses a stream that asks for no client", async () => {
    const fookie = boot();
    const live = liveOf();
    const server = graphqlServer(fookie, {
      port: ["24784"],
      limits: [],
      snapshot: true,
      budget: [],
      realtime: [live],
    });

    const response = await fetch("http://127.0.0.1:24784/stream");
    assert.equal(response.status, 400);
    await response.text();

    await live.stop();
    await server.stop();
    await fookie.stop();
  });

  it("will not watch for events unless realtime is configured", async () => {
    const fookie = boot();
    const server = graphqlServer(fookie, idleGraph);
    assert.throws(() => server.watch(fookie), /realtime required/);
    await server.stop();
    await fookie.stop();
  });
});
