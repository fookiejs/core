import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  app,
  Model,
  External,
  Types,
  Done,
  Running,
  Failed,
  flows,
  type ExternalEventOf,
  type ExternalOutputOf,
} from "../src/index.ts";
import { MockDb, httpPost, trackApp, shutdownLiveApps } from "./mock-db.ts";

let nextPort = 45000;

const fraud = External({
  name: "fraud.score",
  input: { amount: Types.currency },
  output: { score: Types.int },
  attempts: 3,
  backoff: "exponential",
});

const notify = External({
  name: "notify.send",
  input: { to: Types.email, body: Types.string },
  output: { sent: Types.bool },
  attempts: 3,
  backoff: "fixed",
});

const user = Model({
  name: "User",
  fields: {
    email: Types.email.unique(),
    name: Types.string.index(),
  },
  flow: flows({
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
  }),
});

const merchant = Model({
  name: "Merchant",
  fields: {
    site: Types.url,
    rating: Types.float.min(0).max(5),
  },
  flow: flows({
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
  }),
});

const order = Model({
  name: "Order",
  fields: {
    buyer: user,
    merchant: merchant,
    amount: Types.currency,
    score: Types.int,
    status: Types.enum("draft", "confirmed", "shipped"),
  },
  flow: flows({
    async create(flow) {
      flow.metric.increment("created");
      const result = await flow.external(fraud, { amount: flow.body.amount });
      if (result.signal === Running) {
        return Running;
      }
      if (result.signal === Failed) {
        return Failed;
      }
      if (result.output.score > 80) {
        flow.log("riskli işlem reddedildi", { score: result.output.score });
        return Failed;
      }
      flow.body.score = result.output.score;
      flow.body.status = "confirmed";
      const logged = await flow.create(orderLog, { message: "sipariş onaylandı" });
      if (logged.signal === Running) {
        return Running;
      }
      if (logged.signal === Failed) {
        return Failed;
      }
      const notified = await flow.external(notify, {
        to: "ops@example.com",
        body: `sipariş ${flow.id} onaylandı`,
      });
      if (notified.signal === Running) {
        return Running;
      }
      if (notified.signal === Failed) {
        return Failed;
      }
      flow.log("sipariş onaylandı", { score: result.output.score });
      return Done;
    },
    async list(flow) {
      flow.filter.amount.gt(0);
      flow.filter.status.eq("confirmed");
      return Done;
    },
    async update(flow) {
      flow.filter.status.eq("draft");
      flow.metric.increment("updated");
      return Done;
    },
    async delete(flow) {
      flow.filter.status.eq("draft");
      flow.metric.increment("deleted");
      return Done;
    },
  }),
});

const orderLog = Model({
  name: "OrderLog",
  fields: {
    order,
    message: Types.string,
  },
  flow: flows({
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
  }),
});

const externals = [fraud, notify] as const;

type ExternalEvent = ExternalEventOf<(typeof externals)[number]>;

function readEntityId(json: Record<string, unknown>): string {
  const entity = json.entity;
  if (entity && typeof entity === "object" && !Array.isArray(entity) && "id" in entity) {
    const id = entity.id;
    if (typeof id === "string") {
      return id;
    }
  }
  return "";
}

describe("order flow integration", () => {
  let db: MockDb;
  let events: ExternalEvent[];
  let capturedEvents: ExternalEvent[];

  beforeEach(() => {
    db = new MockDb();
    events = [];
    capturedEvents = [];
  });

  afterEach(async () => {
    await shutdownLiveApps();
  });

  function trackEvent(event: ExternalEvent) {
    events.push(event);
    capturedEvents.push(event);
  }

  async function drainExternals(fookie: ReturnType<typeof app<typeof externals>>) {
    for (const event of events.splice(0)) {
      if (event.name === "fraud.score") {
        const output: ExternalOutputOf<typeof fraud> = { score: 42 };
        await fookie.setExternalResult({ externalId: event.externalId, output });
      }
      if (event.name === "notify.send") {
        const output: ExternalOutputOf<typeof notify> = { sent: true };
        await fookie.setExternalResult({ externalId: event.externalId, output });
      }
    }
  }

  async function completeOrder(
    fookie: ReturnType<typeof app<typeof externals>>,
    pending: { signal: "running"; runId: string },
  ) {
    await drainExternals(fookie);
    let signal = await fookie.resume(pending.runId);
    if (signal === "running") {
      await drainExternals(fookie);
      signal = await fookie.resume(pending.runId);
    }
    return signal;
  }

  async function seedOrder(fookie: ReturnType<typeof app<typeof externals>>) {
    const userCreated = await fookie.create(user, {
      email: "seed@example.com",
      name: "Seed User",
    });
    const merchantCreated = await fookie.create(merchant, {
      site: "https://seed.example.com",
      rating: 3,
    });
    if (userCreated.signal !== "done" || merchantCreated.signal !== "done") {
      return false;
    }
    const pending = await fookie.create(order, {
      buyer: userCreated.id,
      merchant: merchantCreated.id,
      amount: 100,
      score: 0,
      status: "draft",
    });
    if (pending.signal !== "running") {
      return false;
    }
    const signal = await completeOrder(fookie, pending);
    if (signal !== "done") {
      return false;
    }
    await fookie.list(order, { status: { eq: "confirmed" } });
    const rows = fookie.listResults();
    return rows.length > 0 ? rows[0] : false;
  }

  it("runs full order create saga with externals and nested log", async () => {
    const fookie = app({
      listen: "3001",
      database: "postgres://mock",
      models: [user, merchant, orderLog, order],
      externals,
      onExternalEvent: async (event) => {
        trackEvent(event);
      },
      pool: db,
    });

    const userCreated = await fookie.create(user, {
      email: "test@example.com",
      name: "Test User",
    });
    assert.equal(userCreated.signal, "done");

    const merchantCreated = await fookie.create(merchant, {
      site: "https://example.com",
      rating: 4.5,
    });
    assert.equal(merchantCreated.signal, "done");

    if (userCreated.signal !== "done" || merchantCreated.signal !== "done") {
      return;
    }

    const pending = await fookie.create(order, {
      buyer: userCreated.id,
      merchant: merchantCreated.id,
      amount: 100,
      score: 0,
      status: "draft",
    });
    assert.equal(pending.signal, "running");
    if (pending.signal !== "running") {
      return;
    }

    await drainExternals(fookie);
    const resumed = await fookie.resume(pending.runId);
    assert.equal(resumed, "running");

    await drainExternals(fookie);
    const done = await fookie.resume(pending.runId);
    assert.equal(done, "done");

    const results = await fookie.list(order, { status: { eq: "confirmed" }, amount: { gt: 0 } });
    assert.equal(results, "done");
    assert.ok(fookie.listResults().length > 0);
    const row = fookie.listResults()[0];
    assert.equal(row?.status, "confirmed");
    assert.equal(row?.score, 42);
    assert.equal(typeof row?.createdAt, "string");
    assert.ok(fookie.logs().length > 0);
    assert.equal(
      fookie.metrics().some((m) => m.name === "order.created"),
      true,
    );

    await fookie.list(orderLog, {});
    assert.ok(fookie.listResults().length > 0);

    assert.equal(
      capturedEvents.some((e) => e.name === "fraud.score"),
      true,
    );
    assert.equal(
      capturedEvents.some((e) => e.name === "notify.send"),
      true,
    );
  });

  it("rejects high fraud score orders", async () => {
    const fookie = app({
      listen: "3002",
      database: "postgres://mock",
      models: [user, merchant, orderLog, order],
      externals,
      onExternalEvent: async (event) => {
        trackEvent(event);
      },
      pool: db,
    });

    const userCreated = await fookie.create(user, {
      email: "risk@example.com",
      name: "Risk User",
    });
    const merchantCreated = await fookie.create(merchant, {
      site: "https://risk.example.com",
      rating: 1,
    });
    if (userCreated.signal !== "done" || merchantCreated.signal !== "done") {
      return;
    }

    const pending = await fookie.create(order, {
      buyer: userCreated.id,
      merchant: merchantCreated.id,
      amount: 50,
      score: 0,
      status: "draft",
    });
    if (pending.signal !== "running") {
      return;
    }

    for (const event of events.splice(0)) {
      if (event.name === "fraud.score") {
        await fookie.setExternalResult({ externalId: event.externalId, output: { score: 99 } });
      }
    }

    assert.equal(await fookie.resume(pending.runId), "failed");
  });

  it("updates and deletes orders like example flows", async () => {
    const fookie = app({
      listen: "3003",
      database: "postgres://mock",
      models: [user, merchant, orderLog, order],
      externals,
      onExternalEvent: async (event) => {
        trackEvent(event);
      },
      pool: db,
    });

    const row = await seedOrder(fookie);
    assert.notEqual(row, false);
    if (row === false || typeof row.id !== "string") {
      return;
    }

    const updateSignal = await fookie.update(order, {
      id: row.id,
      body: { status: "draft" },
      filter: { status: { eq: "confirmed" } },
    });
    assert.equal(updateSignal, "done");
    assert.equal(
      fookie.metrics().some((m) => m.name === "order.updated"),
      true,
    );

    const deleteSignal = await fookie.delete(order, {
      id: row.id,
      filter: { status: { eq: "draft" } },
    });
    assert.equal(deleteSignal, "done");
    assert.equal(
      fookie.metrics().some((m) => m.name === "order.deleted"),
      true,
    );
  });

  it("serves order http api mirroring example models", async () => {
    const port = nextPort;
    nextPort += 10;
    const fookie = trackApp(app({
      listen: String(port),
      database: "postgres://mock",
      models: [user, merchant, orderLog, order],
      externals,
      onExternalEvent: async (event) => {
        trackEvent(event);
      },
      pool: db,
    }));
    fookie.run();

    const userRes = await httpPost(port, "/user/create", {
      body: { email: "http@example.com", name: "Http User" },
    });
    assert.equal(userRes.status, 200);
    assert.equal(userRes.json.signal, "done");

    const merchantRes = await httpPost(port, "/merchant/create", {
      body: { site: "https://http.example.com", rating: 4 },
    });
    assert.equal(merchantRes.status, 200);

    const userId = readEntityId(userRes.json);
    const merchantId = readEntityId(merchantRes.json);

    const orderRes = await httpPost(port, "/order/create", {
      body: {
        buyer: userId,
        merchant: merchantId,
        amount: 75,
        score: 0,
        status: "draft",
      },
    });
    assert.equal(orderRes.json.signal, "running");

    const runId = String(orderRes.json.runId ?? "");
    assert.equal(await completeOrder(fookie, { signal: "running", runId }), "done");

    const listRes = await httpPost(port, "/order/list", {
      filter: { status: { eq: "confirmed" }, amount: { gt: 0 } },
    });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.json.signal, "done");

    const orderRows = listRes.json.results;
    assert.equal(Array.isArray(orderRows), true);
    if (!Array.isArray(orderRows) || orderRows.length === 0) {
      return;
    }
    const orderRow = orderRows[0];
    const orderId =
      orderRow &&
      typeof orderRow === "object" &&
      !Array.isArray(orderRow) &&
      "id" in orderRow &&
      typeof orderRow.id === "string"
        ? orderRow.id
        : "";

    const updateRes = await httpPost(port, `/order/${orderId}/update`, {
      body: { status: "draft" },
      filter: { status: { eq: "confirmed" } },
    });
    assert.equal(updateRes.json.signal, "done");

    const deleteRes = await httpPost(port, `/order/${orderId}/delete`, {
      filter: { status: { eq: "draft" } },
    });
    assert.equal(deleteRes.json.signal, "done");

    await fookie.list(orderLog, {});
    assert.ok(fookie.listResults().length > 0);

    const extRes = await httpPost(port, "/external/result", {
      externalId: "missing",
      output: { score: 1 },
    });
    assert.equal(extRes.json.ok, false);
  });

  it("fails notify external and aborts order saga", async () => {
    const fookie = app({
      listen: "3004",
      database: "postgres://mock",
      models: [user, merchant, orderLog, order],
      externals,
      onExternalEvent: async (event) => {
        trackEvent(event);
      },
      pool: db,
    });

    const userCreated = await fookie.create(user, {
      email: "notify-fail@example.com",
      name: "Notify Fail",
    });
    const merchantCreated = await fookie.create(merchant, {
      site: "https://notify-fail.example.com",
      rating: 2,
    });
    if (userCreated.signal !== "done" || merchantCreated.signal !== "done") {
      return;
    }

    const pending = await fookie.create(order, {
      buyer: userCreated.id,
      merchant: merchantCreated.id,
      amount: 30,
      score: 0,
      status: "draft",
    });
    if (pending.signal !== "running") {
      return;
    }

    await drainExternals(fookie);
    assert.equal(await fookie.resume(pending.runId), "running");

    for (const event of events.splice(0)) {
      if (event.name === "notify.send") {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await fookie.setExternalResult({
            externalId: event.externalId,
            output: { sent: "nope" },
          });
        }
      }
    }

    assert.equal(await fookie.resume(pending.runId), "failed");
  });

  it("binds modeldef relations on nested orderLog create", async () => {
    const fookie = app({
      listen: "3005",
      database: "postgres://mock",
      models: [user, merchant, orderLog, order],
      externals,
      onExternalEvent: async (event) => {
        trackEvent(event);
      },
      pool: db,
    });

    const row = await seedOrder(fookie);
    assert.notEqual(row, false);
    if (row === false) {
      return;
    }

    await fookie.list(orderLog, {});
    const logs = fookie.listResults();
    assert.ok(logs.length > 0);
    const log = logs[0];
    assert.equal(log?.message, "sipariş onaylandı");
    assert.equal(log?.order, row.id);
  });
});
