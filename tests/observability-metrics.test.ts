import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { app, Model, External, Types, Done, Running, flows } from "../src/index.ts";
import { MockDb } from "./mock-db.ts";

const scoreExt = External({
  name: "fraud.score",
  input: { amount: Types.currency },
  output: { score: Types.int },
  attempts: 2,
  backoff: "fixed",
});

describe("observability and external retry", () => {
  let db: MockDb;

  beforeEach(() => {
    db = new MockDb();
  });

  it("records framework operation and external metrics", async () => {
    const user = Model({
      name: "MetricUser",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const result = await flow.external(scoreExt, { amount: flow.body.email.length });
          if (result.signal === Running) {
            return Running;
          }
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

    let dispatched = 0;
    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {
        dispatched += 1;
      },
      pool: db,
    });

    const pending = await fookie.create(user, { email: "m@t.com" });
    assert.equal(pending.signal, "running");
    assert.equal(dispatched, 1);

    const names = fookie.metrics().map((metric) => metric.name);
    assert.ok(names.includes("metricuser.operation.started"));
    assert.ok(names.includes("metricuser.operation.suspended"));
    assert.ok(names.includes("metricuser.external.dispatched"));
    assert.equal(
      names.some((name) => name.endsWith(".operation.duration")),
      true,
    );
  });

  it("retries external on invalid output before failing", async () => {
    const user = Model({
      name: "RetryUser",
      fields: { email: Types.email },
      flow: flows({
        async create(flow) {
          const result = await flow.external(scoreExt, { amount: 5 });
          if (result.signal === Running) {
            return Running;
          }
          if (result.signal === Failed) {
            return Failed;
          }
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

    let dispatchCount = 0;
    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {
        dispatchCount += 1;
      },
      pool: db,
    });

    const pending = await fookie.create(user, { email: "r@t.com" });
    if (pending.signal !== "running") {
      return;
    }

    const entry = [...db.outbox.values()][0];
    const externalId = String(entry?.external_id ?? "");
    await fookie.setExternalResult({ externalId, output: { score: "bad" } });
    assert.equal(dispatchCount, 2);
    assert.equal(
      fookie.metrics().some((metric) => metric.name === "retryuser.external.retry"),
      true,
    );

    await fookie.setExternalResult({ externalId, output: { score: "bad" } });
    assert.equal(
      fookie.metrics().some((metric) => metric.name === "retryuser.external.failed"),
      true,
    );
    assert.equal(await fookie.resume(pending.runId), "failed");
  });

  it("records saga compensate on transaction rollback", async () => {
    const user = Model({
      name: "RollbackUser",
      fields: { email: Types.email },
      flow: flows({
        async create() {
          return Failed;
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

    const fookie = app({
      listen: "0",
      database: "postgres://mock",
      models: [user],
      externals: [scoreExt] as const,
      onExternalEvent: async () => {},
      pool: db,
    });

    const result = await fookie.create(user, { email: "x@y.com" });
    assert.equal(result.signal, "failed");
    assert.equal(
      fookie.metrics().some((metric) => metric.name === "rollbackuser.saga.compensate"),
      true,
    );
  });
});
