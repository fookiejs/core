import { z } from "zod";
import http from "node:http";
import { appendItem } from "@fookiejs/core";
import type {
  BatchConfig,
  RealtimeBus,
  RealtimeOptions,
  RealtimeRule,
  RunEvent,
  SettledEvent,
  SettledSource,
} from "./types.ts";

export { Method } from "./types.ts";

export class RealtimeError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }

  static create(message: string): RealtimeError {
    return new RealtimeError(message);
  }
}

type Sink = {
  push(event: SettledEvent): boolean;
  close(): boolean;
};

const heartbeatMs = 15_000;
const maxBufferedBytes = 1_048_576;
const completeFrame = `event: complete\ndata: {}\n\n`;

function inProcessBus(): RealtimeBus {
  let listeners: readonly ((event: SettledEvent) => void)[] = [];
  return {
    publish(event) {
      let delivered = 0;
      for (const listener of listeners) {
        listener(event);
        delivered += 1;
      }
      return delivered;
    },
    subscribe(listener) {
      listeners = appendItem(listeners, listener);
      return {
        stop() {
          const before = listeners.length;
          listeners = listeners.filter((registered) => registered !== listener);
          return listeners.length < before;
        },
      };
    },
  };
}

function queuedBatch(
  config: BatchConfig,
  emit: (events: readonly SettledEvent[]) => boolean,
): { push(event: SettledEvent): boolean; close(): boolean } {
  let items: readonly SettledEvent[] = [];
  let held: { cancel(): void } | undefined;
  let closed = false;

  function flush(): boolean {
    if (held !== undefined) {
      held.cancel();
      held = undefined;
    }
    const pending = items;
    items = [];
    if (pending.length < 1) {
      return true;
    }
    return emit(pending);
  }

  return {
    push(event) {
      if (closed === true) {
        return false;
      }
      items = appendItem(items, event);
      if (items.length >= config.max) {
        return flush();
      }
      if (config.windowMs < 1) {
        return flush();
      }
      if (held !== undefined) {
        return true;
      }
      const timer = setTimeout(() => {
        held = undefined;
        flush();
      }, config.windowMs);
      timer.unref();
      held = {
        cancel() {
          clearTimeout(timer);
        },
      };
      return true;
    },
    close() {
      if (closed === true) {
        return false;
      }
      closed = true;
      flush();
      return true;
    },
  };
}

function frameOf(events: readonly SettledEvent[]): string {
  if (events.length < 1) {
    throw RealtimeError.create("a frame needs at least one event");
  }
  let facts: readonly {
    model: string;
    operation: string;
    id: string;
    runId: string;
    signal: string;
  }[] = [];
  for (const event of events) {
    facts = appendItem(facts, {
      model: event.model,
      operation: event.operation,
      id: event.id,
      runId: event.runId,
      signal: event.signal.toUpperCase(),
    });
  }
  return `event: next\ndata: ${JSON.stringify({ data: { events: facts } })}\n\n`;
}

function streamSink(res: http.ServerResponse, batch: BatchConfig): Sink {
  let closed = false;
  const timer = setInterval(() => {
    if (closed === true) {
      return;
    }
    res.write(":ping\n\n");
  }, heartbeatMs);
  timer.unref();

  function drop(): boolean {
    if (closed === true) {
      return false;
    }
    closed = true;
    clearInterval(timer);
    res.write(completeFrame);
    res.end();
    return true;
  }

  const queue = queuedBatch(batch, (events) => {
    if (closed === true) {
      return false;
    }
    if (res.writableLength > maxBufferedBytes) {
      drop();
      return false;
    }
    res.write(frameOf(events));
    return true;
  });

  return {
    push(event) {
      if (closed === true) {
        return false;
      }
      return queue.push(event);
    },
    close() {
      if (closed === true) {
        return false;
      }
      queue.close();
      return drop();
    },
  };
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): boolean {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
  return true;
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let chunks: readonly Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      if (Buffer.isBuffer(chunk) === false) {
        return;
      }
      chunks = appendItem(chunks, chunk);
    });
    req.on("end", () => {
      if (chunks.length < 1) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks.slice()).toString("utf8")));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function clientFromUrl(url: string | undefined): string | undefined {
  if (url === undefined) {
    return undefined;
  }
  const queryAt = url.indexOf("?");
  if (queryAt < 0) {
    return undefined;
  }
  const value = new URLSearchParams(url.slice(queryAt + 1)).get("client");
  if (value === null) {
    return undefined;
  }
  if (value.length < 1) {
    return undefined;
  }
  return value;
}

function rulesOf<F>(rules: readonly RealtimeRule<F>[]): readonly RealtimeRule<F>[] {
  if (Array.isArray(rules) === false) {
    throw RealtimeError.create("rules required");
  }
  for (const rule of rules) {
    if (z.string().min(1).safeParse(rule.model.name).success === false) {
      throw RealtimeError.create("rule model name required");
    }
    if (z.string().min(1).safeParse(rule.method).success === false) {
      throw RealtimeError.create("rule method required");
    }
    if (typeof rule.who !== "function") {
      throw RealtimeError.create("rule who required");
    }
  }
  return rules;
}

export class Realtime<F = unknown> {
  private readonly rules: readonly RealtimeRule<F>[];
  private readonly batch: BatchConfig;
  private readonly bus: RealtimeBus;
  private readonly relay: boolean;
  private readonly byClient = new Map<string, readonly Sink[]>();
  private server: http.Server | undefined;
  private settledStop: { stop(): boolean } | undefined;
  private busStop: { stop(): boolean } | undefined;
  private fookie: F | undefined;

  private constructor(rules: readonly RealtimeRule<F>[], options: RealtimeOptions) {
    this.rules = rulesOf(rules);
    if (Array.isArray(options.batch) === false) {
      throw RealtimeError.create("batch options required");
    }
    const declaredBatch = options.batch[0];
    if (declaredBatch === undefined) {
      this.batch = { windowMs: 0, max: 1 };
    } else {
      if (z.number().int().nonnegative().safeParse(declaredBatch.windowMs).success === false) {
        throw RealtimeError.create("batch window must be a non-negative integer");
      }
      if (z.number().int().positive().safeParse(declaredBatch.max).success === false) {
        throw RealtimeError.create("batch max must be a positive integer");
      }
      this.batch = declaredBatch;
    }
    const declaredBus = options.bus[0];
    if (declaredBus === undefined) {
      this.bus = inProcessBus();
      this.relay = false;
    } else {
      this.bus = declaredBus;
      this.relay = true;
    }
    this.busStop = this.bus.subscribe((event) => {
      void this.dispatch(event);
    });
  }

  static create<F>(rules: readonly RealtimeRule<F>[], options: RealtimeOptions): Realtime<F> {
    const live = new Realtime(rules, options);
    if (options.listen.length > 0) {
      live.bind(options.listen);
    }
    return live;
  }

  watch(fookie: F & SettledSource): boolean {
    if (this.settledStop !== undefined) {
      return false;
    }
    this.fookie = fookie;
    this.settledStop = fookie.onOperationSettled((event) => {
      void this.fanout(event);
    });
    return true;
  }

  async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    if (String(req.url).startsWith("/stream") === false) {
      sendJson(res, 404, { errors: [{ message: "not found" }] });
      return false;
    }
    let clientId = clientFromUrl(req.url);
    if (req.method === "POST") {
      const parsed = z
        .object({
          clientId: z.string().min(1),
        })
        .safeParse(await readJsonBody(req));
      if (parsed.success === true) {
        clientId = parsed.data.clientId;
      }
    }
    if (clientId === undefined) {
      sendJson(res, 400, { errors: [{ message: "client is required" }] });
      return false;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(":ok\n\n");
    const sink = streamSink(res, this.batch);
    const membership = this.join(clientId, sink);
    req.on("close", () => {
      membership.stop();
    });
    return true;
  }

  async stop(): Promise<boolean> {
    if (this.settledStop !== undefined) {
      this.settledStop.stop();
      this.settledStop = undefined;
    }
    if (this.busStop !== undefined) {
      this.busStop.stop();
      this.busStop = undefined;
    }
    this.fookie = undefined;
    this.closeAll();
    if (this.server === undefined) {
      return false;
    }
    const running = this.server;
    this.server = undefined;
    await new Promise<boolean>((resolve) => {
      running.close(() => resolve(true));
    });
    return true;
  }

  private bind(port: readonly string[]): boolean {
    if (this.server !== undefined) {
      return true;
    }
    const text = port[0];
    if (text === undefined) {
      return false;
    }
    if (/^\d+$/.test(text) === false) {
      throw RealtimeError.create("port must be digits only");
    }
    const parsed = Number(text);
    if (parsed < 0 || parsed > 65535) {
      throw RealtimeError.create("port out of range");
    }
    const server = http.createServer((req, res) => {
      void this.handle(req, res).catch(() =>
        sendJson(res, 500, { errors: [{ message: "internal error" }] }),
      );
    });
    server.listen(parsed, "127.0.0.1");
    this.server = server;
    return true;
  }

  private join(clientId: string, sink: Sink): { stop(): boolean } {
    if (z.string().min(1).safeParse(clientId).success === false) {
      throw RealtimeError.create("client is required");
    }
    if (typeof sink.push !== "function") {
      throw RealtimeError.create("a subscriber must be able to receive");
    }
    const members = this.byClient.get(clientId);
    if (members === undefined) {
      this.byClient.set(clientId, [sink]);
    } else {
      this.byClient.set(clientId, appendItem(members, sink));
    }
    return {
      stop: () => this.leave(clientId, sink),
    };
  }

  private leave(clientId: string, sink: Sink): boolean {
    const before = this.byClient.get(clientId);
    if (before === undefined) {
      return false;
    }
    const after = before.filter((member) => member !== sink);
    if (after.length === before.length) {
      return false;
    }
    if (after.length === 0) {
      this.byClient.delete(clientId);
      return true;
    }
    this.byClient.set(clientId, after);
    return true;
  }

  private deliver(event: SettledEvent, clientIds: readonly string[]): number {
    if (z.string().min(1).safeParse(event.model).success === false) {
      throw RealtimeError.create("settled event model required");
    }
    let reached: readonly Sink[] = [];
    for (const clientId of clientIds) {
      const members = this.byClient.get(clientId);
      if (members === undefined) {
        continue;
      }
      for (const sink of members) {
        if (reached.includes(sink) === true) {
          continue;
        }
        reached = appendItem(reached, sink);
      }
    }
    let delivered = 0;
    for (const sink of reached) {
      if (sink.push(event) === true) {
        delivered += 1;
      }
    }
    return delivered;
  }

  private closeAll(): void {
    for (const members of this.byClient.values()) {
      for (const sink of members) {
        sink.close();
      }
    }
    this.byClient.clear();
  }

  private async dispatch(event: SettledEvent): Promise<boolean> {
    const fookie = this.fookie;
    if (fookie === undefined) {
      return false;
    }
    let clientIds: readonly string[] = [];
    const connected = [...this.byClient.keys()];
    for (const rule of this.rules) {
      if (rule.model.name !== event.model) {
        continue;
      }
      if (rule.method !== event.operation) {
        continue;
      }
      const picked = await rule.who(connected, fookie);
      for (const clientId of picked) {
        if (clientIds.includes(clientId) === true) {
          continue;
        }
        clientIds = appendItem(clientIds, clientId);
      }
    }
    if (clientIds.length < 1) {
      return false;
    }
    return this.deliver(event, clientIds) > 0;
  }

  private async fanout(event: RunEvent): Promise<boolean> {
    if (this.relay === true) {
      return true;
    }
    const remote = this.bus.publish(event);
    if (typeof remote === "number") {
      return remote > 0;
    }
    await remote;
    return true;
  }
}

export function realtime<F>(
  rules: readonly RealtimeRule<F>[],
  options: RealtimeOptions,
): Realtime<F> {
  return Realtime.create(rules, options);
}
