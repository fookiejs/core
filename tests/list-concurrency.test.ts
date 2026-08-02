import { z } from "zod";
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, app } from "../src/index.ts";
import { MockDb, shutdownLiveApps, trackApp } from "./mock-db.ts";

const note = Model({
  name: "ConcNote",
  fields: { tag: z.string() },
  flow: {
    async create() {
      return Done;
    },
    async list(flow) {
      await flow.trace("settle", async () => Done);
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

describe("concurrent list calls", () => {
  let db: MockDb;

  beforeEach(() => {
    db = new MockDb();
  });

  function boot() {
    return trackApp(
      app({
        listen: "0",
        database: "postgres://mock",
        models: [note],
        externals: [] as const,
        onExternalEvent: async () => {},
        pool: [db],
      }),
    );
  }

  it("gives each caller its own rows", async () => {
    const fookie = boot();
    const first = await fookie.create(note, { tag: "alpha" });
    const second = await fookie.create(note, { tag: "beta" });
    assert.equal(first.signal, "done");
    assert.equal(second.signal, "done");

    const [alpha, beta] = await Promise.all([
      fookie.list(note, { tag: { eq: "alpha" } }),
      fookie.list(note, { tag: { eq: "beta" } }),
    ]);

    assert.equal(alpha?.signal, "done");
    assert.equal(beta?.signal, "done");
    assert.notEqual(alpha?.runId, beta?.runId, "each call is its own run");

    assert.notEqual(alpha?.results, beta?.results, "each call owns its array");
    assert.ok((alpha?.results ?? []).length > 0);
    assert.ok((beta?.results ?? []).length > 0);
    await shutdownLiveApps();
  });

  it("keeps results on the result rather than on the app", async () => {
    const fookie = boot();
    await fookie.create(note, { tag: "gamma" });
    const listed = await fookie.list(note, { tag: { eq: "gamma" } });
    assert.equal(listed.results.length, 1);
    assert.equal("listResults" in fookie, false, "the shared buffer is gone");
    await shutdownLiveApps();
  });
});
