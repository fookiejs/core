import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import http from "node:http";
import { Method, realtime, RealtimeError } from "../src/realtime.ts";
import type { RunEvent } from "../src/types.ts";

type Probe = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  chunks: string[];
  status: { code: number };
  close(): void;
};

const User = { name: "User" };

function probe(url: string, writableLength = 0): Probe {
  const chunks: string[] = [];
  const status = { code: 0 };
  const emitter = new EventEmitter();
  const req = Object.assign(emitter, {
    url,
    method: "GET",
  }) as http.IncomingMessage;
  const res = {
    writableLength,
    writeHead(code: number) {
      status.code = code;
    },
    write(chunk: string | Buffer) {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      return true;
    },
    end(chunk?: string | Buffer) {
      if (chunk !== undefined) {
        chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
      }
    },
  } as unknown as http.ServerResponse;
  return {
    req,
    res,
    chunks,
    status,
    close() {
      emitter.emit("close");
    },
  };
}

function runEvent(id: string, operation = Method.CREATE): RunEvent {
  return {
    model: User.name,
    operation,
    id,
    runId: "run-1",
    signal: "done",
  };
}

function nextPayloads(chunks: readonly string[]): readonly {
  data: {
    events: readonly {
      model: string;
      operation: string;
      id: string;
      runId: string;
      signal: string;
    }[];
  };
}[] {
  const text = chunks.join("");
  let payloads: readonly {
    data: {
      events: readonly {
        model: string;
        operation: string;
        id: string;
        runId: string;
        signal: string;
      }[];
    };
  }[] = [];
  for (const block of text.split("\n\n")) {
    if (block.includes("event: next") === false) {
      continue;
    }
    const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
    if (dataLine === undefined) {
      continue;
    }
    payloads = [...payloads, JSON.parse(dataLine.slice("data: ".length))];
  }
  return payloads;
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

function wire(
  live: ReturnType<typeof realtime>,
  fookie: {
    list: (...args: never[]) => unknown;
    onOperationSettled(listener: (event: RunEvent) => void): { stop(): boolean };
  },
): ((event: RunEvent) => void)[] {
  const listeners: ((event: RunEvent) => void)[] = [];
  live.watch({
    ...fookie,
    onOperationSettled(listener) {
      listeners.push(listener);
      return fookie.onOperationSettled(listener);
    },
  });
  return listeners;
}

function silentFookie(): {
  list: (...args: never[]) => unknown;
  onOperationSettled(listener: (event: RunEvent) => void): { stop(): boolean };
} {
  return {
    list: () => ({ results: [] }),
    onOperationSettled() {
      return {
        stop() {
          return true;
        },
      };
    },
  };
}

describe("realtime", () => {
  it("sends a create only to client ids that who returns", async () => {
    const live = realtime(
      [
        {
          model: User,
          method: Method.CREATE,
          who(clientIds) {
            return clientIds.filter((id) => id === "hit");
          },
        },
      ],
      {
        listen: [],
        bus: [],
        batch: [],
      },
    );
    const hit = probe("/stream?client=hit");
    const miss = probe("/stream?client=miss");
    await live.handle(hit.req, hit.res);
    await live.handle(miss.req, miss.res);
    const listeners = wire(live, silentFookie());
    for (const listener of listeners) {
      listener(runEvent("body-1"));
    }
    await settle();
    const hitEvents = nextPayloads(hit.chunks);
    assert.equal(hitEvents.length, 1);
    const facts = hitEvents[0]?.data.events;
    assert.ok(facts !== undefined);
    assert.deepEqual(facts, [
      {
        model: "User",
        operation: "create",
        id: "body-1",
        runId: "run-1",
        signal: "DONE",
      },
    ]);
    const fact = facts[0];
    assert.ok(fact !== undefined);
    assert.equal("rooms" in fact, false);
    assert.equal(nextPayloads(miss.chunks).length, 0);
    await live.stop();
  });

  it("delivers nothing when who returns no client ids", async () => {
    const live = realtime(
      [
        {
          model: User,
          method: Method.CREATE,
          who() {
            return [];
          },
        },
      ],
      {
        listen: [],
        bus: [],
        batch: [],
      },
    );
    const hit = probe("/stream?client=hit");
    await live.handle(hit.req, hit.res);
    const listeners = wire(live, silentFookie());
    for (const listener of listeners) {
      listener(runEvent("body-1"));
    }
    await settle();
    assert.equal(nextPayloads(hit.chunks).length, 0);
    await live.stop();
  });

  it("does not emit when no rule matches the method", async () => {
    const live = realtime(
      [
        {
          model: User,
          method: Method.CREATE,
          who(clientIds) {
            return clientIds;
          },
        },
      ],
      {
        listen: [],
        bus: [],
        batch: [],
      },
    );
    const hit = probe("/stream?client=hit");
    await live.handle(hit.req, hit.res);
    const listeners = wire(live, silentFookie());
    for (const listener of listeners) {
      listener(runEvent("body-1", Method.UPDATE));
    }
    await settle();
    assert.equal(nextPayloads(hit.chunks).length, 0);
    await live.stop();
  });

  it("passes connected client ids and fookie into who", async () => {
    let seen: readonly string[] = [];
    let listed = 0;
    const fookie = {
      list() {
        listed += 1;
        return { results: [] };
      },
      onOperationSettled() {
        return {
          stop() {
            return true;
          },
        };
      },
    };
    const live = realtime(
      [
        {
          model: User,
          method: Method.CREATE,
          who(clientIds, app) {
            seen = clientIds;
            app.list();
            return clientIds;
          },
        },
      ],
      {
        listen: [],
        bus: [],
        batch: [],
      },
    );
    const first = probe("/stream?client=a");
    const second = probe("/stream?client=b");
    await live.handle(first.req, first.res);
    await live.handle(second.req, second.res);
    const listeners = wire(live, fookie);
    for (const listener of listeners) {
      listener(runEvent("body-1"));
    }
    await settle();
    assert.deepEqual([...seen].sort(), ["a", "b"]);
    assert.equal(listed, 1);
    await live.stop();
  });

  it("forgets a subscriber when the stream closes", async () => {
    const live = realtime(
      [
        {
          model: User,
          method: Method.CREATE,
          who(clientIds) {
            return clientIds;
          },
        },
      ],
      {
        listen: [],
        bus: [],
        batch: [],
      },
    );
    const listenerStream = probe("/stream?client=hit");
    await live.handle(listenerStream.req, listenerStream.res);
    const listeners = wire(live, silentFookie());
    for (const listener of listeners) {
      listener(runEvent("one"));
    }
    await settle();
    assert.equal(nextPayloads(listenerStream.chunks).length, 1);
    listenerStream.close();
    for (const listener of listeners) {
      listener(runEvent("two"));
    }
    await settle();
    assert.equal(nextPayloads(listenerStream.chunks).length, 1);
    await live.stop();
  });

  it("refuses a stream that asks for no client", async () => {
    const live = realtime(
      [
        {
          model: User,
          method: Method.CREATE,
          who(clientIds) {
            return clientIds;
          },
        },
      ],
      {
        listen: [],
        bus: [],
        batch: [],
      },
    );
    const asked = probe("/stream");
    await live.handle(asked.req, asked.res);
    assert.equal(asked.status.code, 400);
    await live.stop();
  });

  it("puts every settled fact in one next frame when the batch window opens", async () => {
    const live = realtime(
      [
        {
          model: User,
          method: Method.CREATE,
          who(clientIds) {
            return clientIds;
          },
        },
      ],
      {
        listen: [],
        bus: [],
        batch: [{ windowMs: 40, max: 64 }],
      },
    );
    const hit = probe("/stream?client=hit");
    await live.handle(hit.req, hit.res);
    const listeners = wire(live, silentFookie());
    for (const listener of listeners) {
      listener(runEvent("a"));
      listener({ ...runEvent("b"), id: "b" });
    }
    assert.equal(nextPayloads(hit.chunks).length, 0);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const payloads = nextPayloads(hit.chunks);
    assert.equal(payloads.length, 1);
    assert.deepEqual(
      payloads[0]?.data.events.map((row) => row.id),
      ["a", "b"],
    );
    await live.stop();
  });

  it("flushes when max is reached without waiting for the window", async () => {
    const live = realtime(
      [
        {
          model: User,
          method: Method.CREATE,
          who(clientIds) {
            return clientIds;
          },
        },
      ],
      {
        listen: [],
        bus: [],
        batch: [{ windowMs: 50, max: 2 }],
      },
    );
    const hit = probe("/stream?client=hit");
    await live.handle(hit.req, hit.res);
    const listeners = wire(live, silentFookie());
    for (const listener of listeners) {
      listener(runEvent("a"));
      listener({ ...runEvent("b"), id: "b" });
    }
    await settle();
    const payloads = nextPayloads(hit.chunks);
    assert.equal(payloads.length, 1);
    assert.deepEqual(
      payloads[0]?.data.events.map((row) => row.id),
      ["a", "b"],
    );
    await live.stop();
  });

  it("refuses a negative window or a max below one", () => {
    assert.throws(
      () =>
        realtime([], {
          listen: [],
          bus: [],
          batch: [{ windowMs: -1, max: 8 }],
        }),
      RealtimeError,
    );
    assert.throws(
      () =>
        realtime([], {
          listen: [],
          bus: [],
          batch: [{ windowMs: 10, max: 0 }],
        }),
      RealtimeError,
    );
  });

  it("closes a stream that exceeds the write buffer", async () => {
    const live = realtime(
      [
        {
          model: User,
          method: Method.CREATE,
          who(clientIds) {
            return clientIds;
          },
        },
      ],
      {
        listen: [],
        bus: [],
        batch: [],
      },
    );
    const hit = probe("/stream?client=hit", 1_048_577);
    await live.handle(hit.req, hit.res);
    const listeners = wire(live, silentFookie());
    for (const listener of listeners) {
      listener(runEvent("body-1"));
    }
    await settle();
    assert.equal(nextPayloads(hit.chunks).length, 0);
    assert.equal(hit.chunks.join("").includes("event: complete"), true);
    await live.stop();
  });
});
