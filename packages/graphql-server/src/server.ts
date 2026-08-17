import { z } from "zod";
import http from "node:http";
import type {
  Realtime as RealtimeInstance,
  SettledEvent,
  SettledSource,
} from "@fookiejs/realtime";
import { buildSchema } from "./graphql-adapter/build.ts";
import type { MutationPort, SchemaBundle } from "./graphql-adapter/build.ts";
import { isMutation, parseQuery, runMutation, runQuery } from "./graphql-adapter/run.ts";
import type { ExecutionResult } from "./graphql-adapter/run.ts";
import { defaultLimits } from "./plan/prefetch.ts";
import type { PrefetchLimits, ReadPort } from "./plan/prefetch.ts";
import { ModelGraph } from "./registry.ts";
import type { RegisteredModelDef } from "./registry.ts";
import { GraphqlServerError } from "./errors.ts";
import { GateFullError, QueryGate, defaultBudget } from "./gate.ts";
import type { GateBudget } from "./gate.ts";
import { loopbackHost, nameSlotOf, readRequest, sendJson, variablesOf } from "./transport.ts";

export type SnapshotPort = {
  withReadSnapshot<T>(run: (scope: ReadPort) => Promise<T>): Promise<T>;
};

export type FookieApp = ReadPort &
  SnapshotPort &
  MutationPort & {
    models(): readonly RegisteredModelDef[];
  };

export type { SettledEvent, SettledSource };

export type GraphqlServerOptions = {
  port: readonly string[];
  limits: readonly PrefetchLimits[];
  snapshot: boolean;
  budget: readonly GateBudget[];
  realtime: readonly RealtimeInstance[];
};

export class GraphqlServer {
  private readonly app: FookieApp;
  private readonly graph: ModelGraph;
  private readonly bundle: SchemaBundle;
  private readonly limits: PrefetchLimits;
  private readonly snapshot: boolean;
  private readonly live: RealtimeInstance | undefined;
  private readonly gate: QueryGate;
  private server: http.Server | undefined;
  private watching = false;

  private constructor(app: FookieApp, options: GraphqlServerOptions) {
    if (app.models().length < 1) {
      throw GraphqlServerError.create("app registers no models");
    }
    this.app = app;
    this.graph = ModelGraph.create(app.models());
    this.bundle = buildSchema(this.graph);
    const declaredLimits = options.limits[0];
    if (declaredLimits === undefined) {
      this.limits = defaultLimits();
    } else {
      if (Number.isInteger(declaredLimits.maxDepth) === false) {
        throw GraphqlServerError.create("limit depth must be an integer");
      }
      this.limits = declaredLimits;
    }
    this.snapshot = options.snapshot;
    const declaredBudget = options.budget[0];
    if (declaredBudget === undefined) {
      this.gate = QueryGate.create(defaultBudget());
    } else {
      if (Number.isInteger(declaredBudget.concurrent) === false) {
        throw GraphqlServerError.create("budget concurrency must be an integer");
      }
      if (Number.isInteger(declaredBudget.queued) === false) {
        throw GraphqlServerError.create("budget queue depth must be an integer");
      }
      this.gate = QueryGate.create(declaredBudget);
    }
    this.live = options.realtime[0];
  }

  inFlight(): number {
    if (this.gate.active() < 0) {
      throw GraphqlServerError.create("in flight count cannot be negative");
    }
    return this.gate.active();
  }

  queued(): number {
    if (this.gate.waiting() < 0) {
      throw GraphqlServerError.create("queued count cannot be negative");
    }
    return this.gate.waiting();
  }

  watch(source: SettledSource): boolean {
    if (this.live === undefined) {
      throw GraphqlServerError.create("realtime required before watching for events");
    }
    if (this.watching === true) {
      return false;
    }
    this.live.watch(source);
    this.watching = true;
    return true;
  }

  static create(app: FookieApp, options: GraphqlServerOptions): GraphqlServer {
    if (typeof app.list !== "function") {
      throw GraphqlServerError.create("app must expose list");
    }
    if (typeof app.models !== "function") {
      throw GraphqlServerError.create("app must expose models");
    }
    if (typeof app.withReadSnapshot !== "function") {
      throw GraphqlServerError.create("app must expose withReadSnapshot");
    }
    if (Array.isArray(options.limits) === false) {
      throw GraphqlServerError.create("options limits required");
    }
    return new GraphqlServer(app, options);
  }

  schemaBundle(): SchemaBundle {
    if (this.bundle.rootFields.size < 1) {
      throw GraphqlServerError.create("schema carries no root fields");
    }
    if (this.bundle.rootFields instanceof Map === false) {
      throw GraphqlServerError.create("schema root fields required");
    }
    return this.bundle;
  }

  async execute(
    query: string,
    variables: Record<string, unknown> = {},
    operationName: readonly string[] = [],
  ): Promise<ExecutionResult> {
    if (z.string().min(1).safeParse(query).success === false) {
      throw GraphqlServerError.create("query required");
    }
    const request = { query, variables, operationName };
    for (const parsed of parseQuery(query)) {
      if (isMutation(parsed, operationName[0]) === true) {
        return await runMutation(this.bundle, this.app, request);
      }
    }
    if (this.snapshot === false) {
      return await this.gate.run(
        async () => await runQuery(this.bundle, this.graph, this.app, request, this.limits),
      );
    }
    return await this.gate.run(
      async () =>
        await this.app.withReadSnapshot(
          async (scope) => await runQuery(this.bundle, this.graph, scope, request, this.limits),
        ),
    );
  }

  run(port: readonly string[]): boolean {
    if (this.server !== undefined) {
      return true;
    }
    const text = port[0];
    if (text === undefined) {
      return false;
    }
    if (/^\d+$/.test(text) === false) {
      throw GraphqlServerError.create("port must be digits only");
    }
    const parsed = Number(text);
    if (parsed < 0 || parsed > 65535) {
      throw GraphqlServerError.create("port out of range");
    }
    const server = http.createServer(this.requestListener());
    server.listen(parsed, loopbackHost);
    this.server = server;
    return true;
  }

  private requestListener(): http.RequestListener {
    if (this.bundle.rootFields.size < 1) {
      throw GraphqlServerError.create("schema carries no root fields");
    }
    return (req, res) => {
      void this.handle(req, res).catch(() =>
        sendJson(res, 500, { errors: [{ message: "internal error" }] }),
      );
    };
  }

  async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    if (String(req.url).startsWith("/stream") === true) {
      if (this.live === undefined) {
        sendJson(res, 404, { errors: [{ message: "realtime is not configured" }] });
        return false;
      }
      return await this.live.handle(req, res);
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { errors: [{ message: "method not allowed" }] });
      return false;
    }
    const bodies = await readRequest(req);
    for (const body of bodies) {
      const names = nameSlotOf(body.operationName);
      try {
        const answered = await this.execute(body.query, variablesOf(body.variables), names);
        return sendJson(res, 200, answered);
      } catch (caught) {
        if (caught instanceof GateFullError === false) {
          throw caught;
        }
        res.setHeader("retry-after", "1");
        sendJson(res, 503, { errors: [{ message: caught.message }] });
        return false;
      }
    }
    sendJson(res, 400, { errors: [{ message: "invalid graphql request" }] });
    return false;
  }

  async stop(): Promise<boolean> {
    this.watching = false;
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
}

export function graphqlServer(app: FookieApp, options: GraphqlServerOptions): GraphqlServer {
  const server = GraphqlServer.create(app, options);
  if (options.port.length > 0) {
    server.run(options.port);
  }
  return server;
}
