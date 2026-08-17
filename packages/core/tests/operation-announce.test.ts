import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, app } from "../src/index.ts";
import { MockDb } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const item = Model({
  name: "AnnounceItem",
  fields: { label: z.string() },
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

describe("operation announce", () => {
  it("asks postgres to notify when a create finishes", async () => {
    const db = new MockDb();
    const fookie = app({
      listen: "0",
      database: Postgres("postgres://mock", [db]),
      models: [item],
      externals: [] as const,
      onExternalEvent: async () => {},
    });
    const made = await fookie.create(item, { label: "one" });
    assert.equal(made.signal, "done");
    assert.equal(
      db.queries.some((sql) => sql.startsWith("SELECT pg_notify(")),
      true,
    );
    await fookie.stop();
  });
});
