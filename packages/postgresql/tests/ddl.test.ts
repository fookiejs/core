import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { schemaVersion, schemaVersionStatements } from "../src/ddl.ts";

describe("schema version", () => {
  it("plants a versioned schema table", () => {
    const statements = schemaVersionStatements();
    assert.equal(schemaVersion, 1);
    assert.equal(statements.some((sql) => sql.includes("fookie_schema")), true);
    assert.equal(
      statements.some((sql) => sql.includes(`VALUES (${String(schemaVersion)})`)),
      true,
    );
  });
});
