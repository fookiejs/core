import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

describe("example.ts contract", () => {
  it("remains unchanged with dont edit marker", () => {
    const source = readFileSync(join(root, "..", "example.ts"), "utf8");
    assert.equal(source.startsWith("// dont edit"), true);
    assert.ok(source.includes("fraud.score"));
    assert.ok(source.includes("notify.send"));
    assert.ok(source.includes('name: "Order"'));
    assert.ok(source.includes("setExternalResult"));
    assert.ok(source.includes("fookie.run()"));
  });
});
