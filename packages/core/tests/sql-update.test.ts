import { z } from "zod";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Done, Model, app } from "../src/index.ts";
import type { OperationEvent } from "../src/index.ts";
import { MockDb, LiveApps } from "./mock-db.ts";
import { Postgres } from "./engines.ts";

const bead = Model({
  name: "SqlBead",
  fields: {
    team: z.string(),
    status: z.string(),
    label: z.string(),
  },
  flow: {
    async create() {
      return Done;
    },
    async list() {
      return Done;
    },
    async update(flow) {
      flow.filter.status.eq("draft");
      return Done;
    },
    async delete() {
      return Done;
    },
  },
});

describe("sql-style update", () => {
  let db: MockDb;
  let apps: LiveApps;
  let port: number;

  beforeEach(() => {
    db = new MockDb();
    apps = new LiveApps();
    port = 35000 + Math.floor(Math.random() * 400);
  });

  afterEach(async () => {
    await apps.shutdown();
  });

  function boot() {
    return apps.track(
      app({
        listen: String(port),
        database: Postgres("postgres://mock", [db]),
        models: [bead],
        externals: [],
        onExternalEvent: async () => {},
      }),
    );
  }

  async function seed(
    fookie: ReturnType<typeof boot>,
    team: string,
    status: string,
    label: string,
  ): Promise<string> {
    const created = await fookie.create(bead, { team, status, label });
    assert.equal(created.signal, Done);
    if (created.signal !== Done) {
      throw new Error("bead must be created");
    }
    return created.id;
  }

  async function labelOf(fookie: ReturnType<typeof boot>, id: string): Promise<string> {
    const listed = await fookie.list(bead, {});
    assert.equal(listed.signal, Done);
    for (const row of listed.results) {
      if (row.id !== id) {
        continue;
      }
      const label = row.label;
      if (typeof label !== "string") {
        throw new Error("bead label required");
      }
      return label;
    }
    throw new Error("bead row required");
  }

  it("patches every match, leaves non-matches, and ANDs flow filters", async () => {
    const fookie = boot();
    const seen: OperationEvent[] = [];
    fookie.onOperationSettled((event) => {
      seen.push(event);
    });

    const redDraftA = await seed(fookie, "red", "draft", "a");
    const redDraftB = await seed(fookie, "red", "draft", "b");
    const redPublished = await seed(fookie, "red", "published", "c");
    const blueDraft = await seed(fookie, "blue", "draft", "d");

    const updated = await fookie.update(bead, { team: { eq: "red" } }, { label: "patched" });
    assert.equal(updated.signal, Done);
    assert.equal(updated.ids.length, 2);
    assert.equal(updated.ids.includes(redDraftA), true);
    assert.equal(updated.ids.includes(redDraftB), true);
    assert.equal(updated.ids.includes(redPublished), false);
    assert.equal(updated.ids.includes(blueDraft), false);

    assert.equal(await labelOf(fookie, redDraftA), "patched");
    assert.equal(await labelOf(fookie, redDraftB), "patched");
    assert.equal(await labelOf(fookie, redPublished), "c");
    assert.equal(await labelOf(fookie, blueDraft), "d");

    const updateEvents = seen.filter((event) => event.operation === "update");
    assert.equal(updateEvents.length, 2);
    const emitted = updateEvents.map((event) => event.id);
    assert.equal(emitted.includes(redDraftA), true);
    assert.equal(emitted.includes(redDraftB), true);
  });

  it("succeeds with zero ids when nothing matches", async () => {
    const fookie = boot();
    const untouched = await seed(fookie, "red", "published", "keep");
    const updated = await fookie.update(bead, { team: { eq: "green" } }, { label: "gone" });
    assert.equal(updated.signal, Done);
    assert.equal(updated.ids.length, 0);
    assert.equal(await labelOf(fookie, untouched), "keep");
  });
});
