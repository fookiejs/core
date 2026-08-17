import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { app, Failed, Model } from "../src/index.ts";
import type { InjectablePool } from "../../postgresql/src/pool.ts";
import { Postgres } from "./engines.ts";

const user = Model({
  name: "ErrUser",
  fields: { email: z.string().email() },
  flow: {
    create: async () => "done",
    list: async () => "done",
    update: async () => "done",
    delete: async () => "done",
  },
});

function throwingPool(error: unknown): InjectablePool {
  return {
    query: async () => {
      throw error;
    },
    connect: async () => ({
      query: async () => {
        throw error;
      },
      release: () => true,
    }),
    end: [],
  };
}

describe("database error reporting", () => {
  it("falls back to a generic message when the thrown value is not an Error", async () => {
    const fookie = app({
      listen: "0",
      database: Postgres("postgres://unused", [throwingPool("")]),
      models: [user],
      externals: [],
      onExternalEvent: async () => {},
    });
    const result = await fookie.create(user, { email: "a@b.com" });
    assert.equal(result.signal, Failed);
    const failure = fookie.logs().find((entry) => entry.message === "database unavailable");
    assert.equal(failure?.fields.reason, "database unavailable");
  });

  it("reports the stringified value when a non-Error with content is thrown", async () => {
    const fookie = app({
      listen: "0",
      database: Postgres("postgres://unused", [throwingPool("disk on fire")]),
      models: [user],
      externals: [],
      onExternalEvent: async () => {},
    });
    const result = await fookie.create(user, { email: "a@b.com" });
    assert.equal(result.signal, Failed);
    const failure = fookie.logs().find((entry) => entry.message === "database unavailable");
    assert.equal(failure?.fields.reason, "disk on fire");
  });
});
