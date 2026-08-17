import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "@fookiejs/core";
import { Postgres } from "../src/index.ts";

describe("Postgres engine", () => {
  it("accepts postgres urls and rejects others", () => {
    const engine = Postgres("postgres://localhost/app");
    assert.equal(engine.kind, "postgres");
    assert.equal(engine.softDelete, true);
    assert.equal(Postgres("postgres://localhost/app", [], { softDelete: false }).softDelete, false);
    assert.equal(engine.key, "postgres://localhost/app");
    assert.equal(Postgres("postgresql://localhost/app").kind, "postgres");
    assert.throws(() => Postgres(""), ValidationError);
    assert.throws(() => Postgres("redis://localhost"), ValidationError);
  });
});
