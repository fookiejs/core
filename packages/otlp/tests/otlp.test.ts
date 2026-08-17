import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { otlp } from "../src/index.ts";

describe("otlp", () => {
  it("returns nothing when the endpoint env is unset", async () => {
    const previous = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const handles = await otlp("fookie-test");
    assert.equal(handles.length, 0);
    if (previous !== undefined) {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = previous;
    }
  });

  it("refuses an empty service name", async () => {
    const handles = await otlp("");
    assert.equal(handles.length, 0);
  });
});
