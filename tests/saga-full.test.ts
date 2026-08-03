import { z } from "zod";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { app, Model, External, Done, Running, Failed, FailureClass, Phase } from "../src/index.ts";
import { MockDb, httpPost, serveApp } from "./mock-db.ts";

type Seen = { id: string; name: string };

const releaseStock = External({
  name: "sf.release",
  input: { sku: z.string(), holdId: z.string() },
  output: { released: z.boolean() },
  attempts: 8,
  backoff: "exponential",
  timeoutMs: 10_000,
});

const reserveStock = External({
  name: "sf.reserve",
  input: { sku: z.string() },
  output: { holdId: z.string() },
  attempts: 3,
  backoff: "exponential",
  timeoutMs: 10_000,
  compensate: releaseStock,
});

const riskCheck = External({
  name: "sf.risk",
  input: { amount: z.number().finite().nonnegative() },
  output: { score: z.number().int() },
  attempts: 3,
  backoff: "fixed",
  timeoutMs: 5_000,
});

const receipt = External({
  name: "sf.receipt",
  input: { to: z.string().email() },
  output: { sent: z.boolean() },
  attempts: 4,
  backoff: "fixed",
  timeoutMs: 5_000,
});

function orderModel(name: string, rejectAt: number) {
  return Model({
    name,
    fields: { amount: z.number().finite().nonnegative(), sku: z.string(), score: z.number().int() },
    flow: {
      async create(flow) {
        const held = await flow.external(reserveStock, { sku: flow.body.sku });
        if (held.signal !== Done) {
          return held.signal;
        }
        const risk = await flow.external(riskCheck, { amount: flow.body.amount });
        if (risk.signal !== Done) {
          return risk.signal;
        }
        if (risk.output.score > rejectAt) {
          return Failed;
        }
        flow.body.score = risk.output.score;
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
}

const acceptOrder = orderModel("SfAccept", 90);
const rejectOrder = orderModel("SfReject", 10);

function bootApp(db: MockDb, seen: Seen[], models: Parameters<typeof app>[0]["models"]) {
  return app({
    listen: "0",
    database: "postgres://mock",
    models,
    externals: [reserveStock, riskCheck, releaseStock, receipt] as const,
    onExternalEvent: async (event) => {
      seen.push({ id: event.externalId, name: event.name });
    },
    pool: [db],
  });
}

async function drive(
  fookie: ReturnType<typeof bootApp>,
  seen: Seen[],
  runId: string,
  score: number,
) {
  let signal: string = Running;
  for (let round = 0; round < 8; round += 1) {
    for (const event of seen.splice(0)) {
      if (event.name === "sf.reserve") {
        await fookie.setExternalResult({ externalId: event.id, output: { holdId: "HOLD-1" } });
      } else if (event.name === "sf.risk") {
        await fookie.setExternalResult({ externalId: event.id, output: { score } });
      }
    }
    signal = await fookie.resume(runId);
    if (signal !== Running) {
      break;
    }
  }
  return signal;
}

describe("saga compensation", () => {
  it("dispatches the declared undo with the forward step's input and output merged", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [rejectOrder]);
    const started = await fookie.create(rejectOrder, { amount: 900, sku: "S9", score: 0 });
    assert.equal(started.signal, Running);

    const signal = await drive(fookie, seen, started.runId, 95);
    assert.equal(signal, Failed, "a high score fails the flow");

    const rows = [...db.outbox.values()];
    const undo = rows.find((row) => row.name === "sf.release");
    assert.ok(undo, "the declared undo was dispatched");
    assert.ok(undo.compensation_of, "the undo links back to its forward step");
    assert.equal(undo.status, "pending", "the undo is queued for the worker");

    const undoInput = undo.input as unknown as Record<string, unknown>;
    assert.equal(undoInput.holdId, "HOLD-1", "the undo received the forward OUTPUT");
    assert.equal(undoInput.sku, "S9", "the undo received the forward INPUT");
    await fookie.stop();
  });

  it("skips steps that declare no undo instead of inventing one", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [rejectOrder]);
    const started = await fookie.create(rejectOrder, { amount: 900, sku: "S9", score: 0 });
    await drive(fookie, seen, started.runId, 95);

    const undoneNames = [...db.outbox.values()]
      .filter((row) => row.compensation_of !== null)
      .map((row) => row.name);
    assert.deepEqual(undoneNames, ["sf.release"], "only the step with a compensation was undone");
    await fookie.stop();
  });

  it("records the run phase across the whole lifecycle", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [acceptOrder]);
    const started = await fookie.create(acceptOrder, { amount: 100, sku: "S1", score: 0 });
    assert.equal(db.runs.get(started.runId)?.saga_phase, Phase.Forward, "suspended is forward");

    const signal = await drive(fookie, seen, started.runId, 5);
    assert.equal(signal, Done);
    assert.equal(db.runs.get(started.runId)?.saga_phase, Phase.Completed, "done is completed");
    await fookie.stop();
  });
});

describe("saga step identity", () => {
  it("gives two identical external calls distinct outbox rows", async () => {
    const twice = Model({
      name: "SfTwice",
      fields: { to: z.string().email() },
      flow: {
        async create(flow) {
          const first = await flow.external(receipt, { to: flow.body.to });
          if (first.signal !== Done) {
            return first.signal;
          }
          const second = await flow.external(receipt, { to: flow.body.to });
          if (second.signal !== Done) {
            return second.signal;
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
      },
    });

    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [twice]);
    const started = await fookie.create(twice, { to: "same@example.com" });
    assert.equal(started.signal, Running);

    let signal: string = Running;
    for (let round = 0; round < 6; round += 1) {
      for (const event of seen.splice(0)) {
        await fookie.setExternalResult({ externalId: event.id, output: { sent: true } });
      }
      signal = await fookie.resume(started.runId);
      if (signal !== Running) {
        break;
      }
    }
    assert.equal(signal, Done);
    assert.equal(db.outbox.size, 2, "identical calls must not collide onto one row");
    await fookie.stop();
  });
});

describe("dispatcher and failure reporting", () => {
  const mailOnly = Model({
    name: "SfMail",
    fields: { to: z.string().email() },
    flow: {
      async create(flow) {
        const sent = await flow.external(receipt, { to: flow.body.to });
        return sent.signal === Running ? Running : Done;
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

  it("tick redispatches a due row and bumps the attempt", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [mailOnly]);
    await fookie.create(mailOnly, { to: "a@b.com" });
    assert.equal(seen.length, 1, "the first dispatch is inline");

    const dispatched = await fookie.tick();
    assert.equal(dispatched, 1, "tick found the due row");
    assert.equal(seen.length, 2, "the worker saw it again");
    assert.equal([...db.outbox.values()][0]?.attempt, 2, "the attempt was bumped");
    await fookie.stop();
  });

  it("a transient failure reschedules while budget remains", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [mailOnly]);
    await fookie.create(mailOnly, { to: "a@b.com" });

    const accepted = await fookie.setExternalFailure({
      externalId: seen[0]?.id ?? "",
      reason: "smtp timeout",
      failure: FailureClass.Transient,
    });
    assert.equal(accepted, true);

    const row = [...db.outbox.values()][0];
    assert.equal(row?.status, "pending", "still pending");
    assert.equal(row?.attempt, 2, "one attempt consumed");
    assert.ok(row?.next_attempt_at, "rescheduled for the dispatcher");
    await fookie.stop();
  });

  it("a permanent failure dead-letters immediately and is listed for operators", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [mailOnly]);
    await fookie.create(mailOnly, { to: "a@b.com" });

    await fookie.setExternalFailure({
      externalId: seen[0]?.id ?? "",
      reason: "template missing",
      failure: FailureClass.Permanent,
    });

    const row = [...db.outbox.values()][0];
    assert.equal(row?.status, "dead_letter", "permanent skips the remaining budget");
    assert.equal(row?.error, "template missing", "the reason is persisted");
    assert.equal(fookie.deadLetters().length, 1, "operators can list dead letters");
    await fookie.stop();
  });

  it("a permanent failure compensates the steps that already completed", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [acceptOrder]);
    const created = await fookie.create(acceptOrder, { amount: 50, sku: "SKU-9", score: 0 });
    assert.equal(created.signal, Running);
    if (created.signal !== Running) {
      throw new Error("the flow must suspend on reserveStock");
    }

    const held = seen[0];
    assert.equal(held?.name, "sf.reserve");
    await fookie.setExternalResult({ externalId: held?.id ?? "", output: { holdId: "HOLD-1" } });

    const risk = seen[1];
    assert.equal(risk?.name, "sf.risk", "the flow advanced to the second step");
    await fookie.setExternalFailure({
      externalId: risk?.id ?? "",
      reason: "scoring offline",
      failure: FailureClass.Permanent,
    });

    const undo = [...db.outbox.values()].filter((row) => row.compensation_of !== null);
    assert.equal(undo.length, 1, "the completed reservation is being released");
    assert.equal(undo[0]?.name, "sf.release");
    assert.equal(undo[0]?.status, "pending");

    const runRow = db.runs.get(created.runId);
    assert.equal(runRow?.saga_phase, "compensating", "the run is undoing, not stuck");
    await fookie.stop();
  });

  it("retryExternal revives a dead-lettered row", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [mailOnly]);
    await fookie.create(mailOnly, { to: "a@b.com" });
    const externalId = seen[0]?.id ?? "";

    await fookie.setExternalFailure({
      externalId,
      reason: "bad",
      failure: FailureClass.Permanent,
    });
    assert.equal(await fookie.retryExternal(externalId), true);

    const row = [...db.outbox.values()][0];
    assert.equal(row?.status, "pending", "back in the queue");
    assert.equal(row?.attempt, 1, "the budget was reset");
    await fookie.stop();
  });

  it("arms its timer on run and clears it on stop without holding the process open", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [mailOnly]);
    await serveApp(fookie);

    const box = (fookie as unknown as { dispatcherBox: { timers: { hasRef(): boolean }[] } })
      .dispatcherBox;
    assert.equal(box.timers.length, 1, "run armed the dispatcher");
    assert.equal(box.timers[0]?.hasRef(), false, "the timer is unref'd");

    await fookie.stop();
    assert.equal(box.timers.length, 0, "stop cleared it");
  });
});

describe("crash recovery", () => {
  it("a second process finishes a run the first left suspended", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];

    const first = bootApp(db, seen, [acceptOrder]);
    const started = await first.create(acceptOrder, { amount: 100, sku: "S1", score: 0 });
    assert.equal(started.signal, Running);
    assert.equal(db.runs.get(started.runId)?.saga_phase, Phase.Forward);
    await first.stop();

    const second = bootApp(db, seen, [acceptOrder]);
    const signal = await drive(second, seen, started.runId, 5);
    assert.equal(signal, Done, "the recovered run finished in the new process");
    assert.equal(db.runs.get(started.runId)?.saga_phase, Phase.Completed);
    await second.stop();
  });

  it("marks a run stuck when its model is no longer registered", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const first = bootApp(db, seen, [acceptOrder]);
    const started = await first.create(acceptOrder, { amount: 100, sku: "S1", score: 0 });
    await first.stop();

    const unrelated = Model({
      name: "SfUnrelated",
      fields: { note: z.string() },
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
    const second = bootApp(db, seen, [unrelated]);
    await second.list(unrelated, {});

    const row = db.runs.get(started.runId);
    assert.equal(row?.saga_phase, Phase.Stuck, "an unknown model is stuck, not silently dropped");
    assert.equal(row?.error, "model no longer registered");
    await second.stop();
  });
});

describe("create result and http surface", () => {
  const plain = Model({
    name: "SfPlain",
    fields: { note: z.string() },
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

  it("create carries id and runId on every arm", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [plain]);
    const created = await fookie.create(plain, { note: "n" });
    assert.equal(created.signal, Done);
    assert.ok(created.id.length > 0, "id is present without narrowing on the signal");
    assert.ok(created.runId.length > 0, "runId is present too");
    await fookie.stop();
  });

  it("POST /external/failure validates its payload and dead-letters", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const fookie = bootApp(db, seen, [
      Model({
        name: "SfHttp",
        fields: { to: z.string().email() },
        flow: {
          async create(flow) {
            const sent = await flow.external(receipt, { to: flow.body.to });
            return sent.signal === Running ? Running : Done;
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
      }),
    ]);
    await serveApp(fookie);
    const servers = (
      fookie as unknown as { serverBox: { servers: { address(): { port: number } }[] } }
    ).serverBox.servers;
    const port = servers[0]?.address().port ?? 0;

    const created = await httpPost(port, "/sfhttp/create", { body: { to: "a@b.com" } });
    assert.equal(created.json.signal, "running");
    assert.ok(created.json.id, "the http create response carries the id");
    const externalId = seen[0]?.id ?? "";

    const noClass = await httpPost(port, "/external/failure", { externalId, reason: "x" });
    assert.equal(noClass.status, 400);
    assert.equal(noClass.json.error, "invalid failure class");

    const noReason = await httpPost(port, "/external/failure", {
      externalId,
      reason: "",
      failure: "permanent",
    });
    assert.equal(noReason.status, 400);
    assert.equal(noReason.json.error, "invalid reason");

    const accepted = await httpPost(port, "/external/failure", {
      externalId,
      reason: "template missing",
      failure: "permanent",
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.json.signal, "done");
    assert.equal([...db.outbox.values()][0]?.status, "dead_letter");
    await fookie.stop();
  });
});

describe("flow.pg", () => {
  it("runs the caller's query inside the flow's own transaction", async () => {
    const db = new MockDb();
    const seen: Seen[] = [];
    const reporter = Model({
      name: "SfReport",
      fields: { label: z.string() },
      flow: {
        async create(flow) {
          await flow.pg.query(
            "SELECT label, COUNT(*) AS n FROM public.sf_report WHERE label = $1 GROUP BY label",
            [flow.body.label],
          );
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
    const fookie = bootApp(db, seen, [reporter]);
    const created = await fookie.create(reporter, { label: "a" });
    assert.equal(created.signal, Done);

    const beginAt = db.queries.indexOf("BEGIN");
    const commitAt = db.queries.indexOf("COMMIT");
    const queryAt = db.queries.findIndex((sql) => sql.includes("GROUP BY label"));
    assert.ok(beginAt >= 0 && commitAt > beginAt, "a transaction was opened and committed");
    assert.ok(
      queryAt > beginAt && queryAt < commitAt,
      "the flow query ran between BEGIN and COMMIT",
    );
    await fookie.stop();
  });
});
