import { z } from "zod";
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, app } from "../src/index.ts";
import type { OperationEvent } from "../src/index.ts";
import { MockDb, shutdownLiveApps, trackApp } from "./mock-db.ts";

const child = Model({
  name: "CursorChild",
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

const parent = Model({
  name: "CursorParent",
  fields: { email: z.string().email() },
  flow: {
    async create(flow) {
      flow.room("tenant:acme");
      flow.log("parent created", {});
      const nested = await flow.create(child, { label: "n" });
      return nested.signal;
    },
    async list() {
      return Done;
    },
    async update(flow) {
      flow.room("tenant:acme");
      return Done;
    },
    async delete() {
      return Done;
    },
  },
});

describe("observability cursor, parents and rooms", () => {
  let db: MockDb;

  beforeEach(() => {
    db = new MockDb();
  });

  function boot() {
    return trackApp(
      app({
        listen: "0",
        database: "postgres://mock",
        models: [parent, child],
        externals: [] as const,
        onExternalEvent: async () => {},
        pool: [db],
      }),
    );
  }

  it("gives every entry a place in one monotonic sequence", async () => {
    const fookie = boot();
    await fookie.create(parent, { email: "seq@x.com" });

    const page = fookie.observability(0);
    const seqs: number[] = [];
    for (const logEntry of page.logs) {
      seqs.push(logEntry.seq);
    }
    for (const metricEntry of page.metrics) {
      seqs.push(metricEntry.seq);
    }
    for (const spanEntry of page.spans) {
      seqs.push(spanEntry.seq);
    }
    assert.ok(seqs.length > 0);
    assert.equal(new Set(seqs).size, seqs.length, "no sequence number repeats across buffers");
    assert.equal(page.oldestSeq, Math.min(...seqs));
    assert.equal(page.nextSeq, Math.max(...seqs));
    await shutdownLiveApps();
  });

  it("returns only what the cursor has not seen", async () => {
    const fookie = boot();
    await fookie.create(parent, { email: "one@x.com" });
    const first = fookie.observability(0);

    await fookie.create(parent, { email: "two@x.com" });
    const second = fookie.observability(first.nextSeq);

    for (const logEntry of second.logs) {
      assert.ok(logEntry.seq > first.nextSeq);
    }
    assert.ok(second.nextSeq > first.nextSeq);
    const empty = fookie.observability(second.nextSeq);
    assert.equal(empty.logs.length, 0);
    assert.equal(empty.spans.length, 0);
    await shutdownLiveApps();
  });

  it("records who called a nested operation instead of leaving it to be guessed", async () => {
    const fookie = boot();
    await fookie.create(parent, { email: "nest@x.com" });

    const spans = fookie.observability(0).spans;
    const nested = spans.filter((spanEntry) => spanEntry.model === "CursorChild");
    assert.ok(nested.length > 0, "the nested create produced a span");
    for (const spanEntry of nested) {
      assert.deepEqual(spanEntry.parentModel, ["CursorParent"]);
      assert.equal(spanEntry.parentEntityId.length, 1);
    }

    const roots = spans.filter((spanEntry) => spanEntry.name === "cursorparent.create");
    for (const spanEntry of roots) {
      assert.deepEqual(spanEntry.parentModel, [], "a root operation has no parent");
    }
    await shutdownLiveApps();
  });

  it("carries metric entity ids and span attributes", async () => {
    const fookie = boot();
    await fookie.create(parent, { email: "attr@x.com" });
    const page = fookie.observability(0);

    for (const metricEntry of page.metrics) {
      assert.equal(typeof metricEntry.entityId === "string", true);
    }
    const withModel = page.spans.filter((spanEntry) => spanEntry.attributes.model !== undefined);
    assert.ok(withModel.length > 0, "span attributes reach the buffer");
    await shutdownLiveApps();
  });

  it("delivers a settled event carrying the rooms the flow chose", async () => {
    const fookie = boot();
    const seen: OperationEvent[] = [];
    const subscription = fookie.onOperationSettled((event) => {
      seen.push(event);
    });

    const created = await fookie.create(parent, { email: "room@x.com" });
    assert.equal(seen.length, 1);
    for (const event of seen) {
      assert.equal(event.model, "CursorParent");
      assert.equal(event.operation, "create");
      assert.equal(event.signal, created.signal);
      assert.deepEqual(event.rooms, ["tenant:acme"]);
    }

    assert.equal(subscription.stop(), true);
    await fookie.create(parent, { email: "after@x.com" });
    assert.equal(seen.length, 1, "a stopped listener hears nothing more");
    await shutdownLiveApps();
  });

  it("survives a listener that throws", async () => {
    const fookie = boot();
    fookie.onOperationSettled(() => {
      throw new Error("subscriber exploded");
    });

    const created = await fookie.create(parent, { email: "boom@x.com" });
    assert.equal(created.signal, "done", "a broken subscriber must not fail the run");
    await shutdownLiveApps();
  });
});
