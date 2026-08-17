import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationError } from "../src/errors.ts";
import { entityRecordFromPlain } from "../src/values.ts";

describe("entityRecordFromPlain", () => {
  it("keeps a valid scalar record", () => {
    const entity = entityRecordFromPlain({ id: "a", n: 1, ok: true });
    assert.equal(entity.id, "a");
    assert.equal(entity.n, 1);
    assert.equal(entity.ok, true);
  });

  it("rejects a payload that is not a record", () => {
    assert.throws(() => entityRecordFromPlain(1 as never), ValidationError);
    assert.throws(() => entityRecordFromPlain(null as never), ValidationError);
    assert.throws(() => entityRecordFromPlain(["x"] as never), ValidationError);
  });
});
