import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@fookiejs/core";
import { Redis } from "../src/index.ts";
import type { RedisDriver } from "../src/index.ts";

describe("Redis engine", () => {
  it("accepts redis urls and rejects others", () => {
    const engine = Redis("redis://localhost:6379");
    assert.equal(engine.kind, "redis");
    assert.equal(engine.softDelete, true);
    assert.equal(Redis("redis://localhost:6379", [], { softDelete: false }).softDelete, false);
    assert.equal(engine.key, "redis://localhost:6379");
    assert.equal(Redis("rediss://localhost:6379").kind, "redis");
    assert.throws(() => Redis(""), ValidationError);
    assert.throws(() => Redis("postgres://localhost"), ValidationError);
  });

  it("uses an injected driver instead of opening a socket", async () => {
    const driver: RedisDriver = {
      async connect(): Promise<boolean> {
        return true;
      },
      async get(): Promise<readonly string[]> {
        return [];
      },
      async mGet(): Promise<readonly (readonly string[])[]> {
        return [];
      },
      async set(): Promise<boolean> {
        return true;
      },
      async del(): Promise<boolean> {
        return true;
      },
      async sAdd(): Promise<boolean> {
        return true;
      },
      async sRem(): Promise<boolean> {
        return true;
      },
      async sMembers(): Promise<readonly string[]> {
        return [];
      },
      end: [],
    };
    const engine = Redis("redis://memory", [driver]);
    const binding = engine.open({ onDbError: [] });
    assert.equal(binding.database, "redis://memory");
    assert.equal(binding.close.length, 0);
  });
});
