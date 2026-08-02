import { z } from "zod";
import { metrics as otelMetrics, trace, SpanStatusCode } from "@opentelemetry/api";
import type { Attributes, Counter, Histogram, Span } from "@opentelemetry/api";
import type { Runtime } from "./engine/runtime.ts";
import { ValidationError } from "./errors.ts";
import type { FilterInput } from "./filter/schema.ts";
import { isoNow } from "./model.ts";
import { dbErrorMessageForLog } from "./pg/encode.ts";
import { appendItem, mapLookup } from "./slot.ts";
import type { EntityValue } from "./values.ts";

export type LogFieldValueKinds = {
  entity: EntityValue;
  filter: FilterInput;
};

export type LogFieldValue = LogFieldValueKinds[keyof LogFieldValueKinds];

export type LogEntry = {
  seq: number;
  level: string;
  message: string;
  traceId: string;
  model: string;
  entityId: string;
  operation: string;
  timestamp: string;
  fields: Record<string, LogFieldValue>;
};

export type MetricEntry = {
  seq: number;
  name: string;
  value: number;
  traceId: string;
  model: string;
  entityId: string;
  timestamp: string;
};

export type SpanEntry = {
  seq: number;
  name: string;
  traceId: string;
  model: string;
  entityId: string;
  operation: string;
  parentModel: readonly string[];
  parentEntityId: readonly string[];
  attributes: Record<string, string>;
  startedAt: string;
  endedAt: string;
};

export type ObservabilityPage = {
  logs: readonly LogEntry[];
  metrics: readonly MetricEntry[];
  spans: readonly SpanEntry[];
  nextSeq: number;
  oldestSeq: number;
};

export const observabilityBufferLimit = 10_000;

export const dispatchIntervalMs = 5_000;

export const pruneIntervalMs = 3_600_000;

export const retentionMs = 30 * 24 * 3_600_000;

export const runBufferLimit = 10_000;

export const lockTimeoutMs = 3_000;

export const maxWriteAttempts = 3;

export const writeRetryBackoffMs = 25;

export const snapshotStatementTimeoutMs = 10_000;

export const snapshotIdleTimeoutMs = 15_000;

export function pushBounded<T>(buffer: readonly T[], bufferItem: T): T[] {
  if (Array.isArray(buffer) === false) {
    throw ValidationError.create("observability buffer required");
  }
  if (observabilityBufferLimit < 1) {
    throw ValidationError.create("observability buffer limit required");
  }
  if (buffer.length >= observabilityBufferLimit) {
    return appendItem(buffer.slice(1), bufferItem);
  }
  return appendItem(buffer, bufferItem);
}

export type ObsBuffers = {
  logs: readonly LogEntry[];
  metrics: readonly MetricEntry[];
  spans: readonly SpanEntry[];
};

export type ObsScopeParent = {
  model: string;
  entityId: string;
};

export type ObsScope = {
  traceId: string;
  model: string;
  entityId: string;
  operation: string;
  parent: readonly ObsScopeParent[];
};

function parentModelOf(scope: ObsScope): readonly string[] {
  if (Array.isArray(scope.parent) === false) {
    throw ValidationError.create("obs scope parent required");
  }
  let names: readonly string[] = [];
  for (const parent of scope.parent) {
    if (z.string().min(1).safeParse(parent.model).success === false) {
      continue;
    }
    names = appendItem(names, parent.model);
  }
  return names;
}

function parentEntityIdOf(scope: ObsScope): readonly string[] {
  if (Array.isArray(scope.parent) === false) {
    throw ValidationError.create("obs scope parent required");
  }
  let ids: readonly string[] = [];
  for (const parent of scope.parent) {
    if (z.string().min(1).safeParse(parent.entityId).success === false) {
      continue;
    }
    ids = appendItem(ids, parent.entityId);
  }
  return ids;
}

function textAttributesOf(attributes: Attributes): Record<string, string> {
  const plain: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (z.string().min(1).safeParse(key).success === false) {
      continue;
    }
    plain[key] = String(value);
  }
  return plain;
}

export class Observability {
  readonly buffers: ObsBuffers = { logs: [], metrics: [], spans: [] };
  private readonly seqBox: { next: number } = { next: 1 };

  private nextSeq(): number {
    if (Number.isInteger(this.seqBox.next) === false) {
      throw ValidationError.create("observability sequence corrupted");
    }
    if (this.seqBox.next < 1) {
      throw ValidationError.create("observability sequence corrupted");
    }
    const assigned = this.seqBox.next;
    this.seqBox.next += 1;
    return assigned;
  }
  private readonly tracer = trace.getTracer("fookie");
  private readonly meter = otelMetrics.getMeter("fookie");
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();

  info(scope: ObsScope, message: string, fields: Record<string, LogFieldValue>): void {
    const logEntry: LogEntry = {
      seq: this.nextSeq(),
      level: "info",
      message,
      traceId: scope.traceId,
      model: scope.model,
      entityId: scope.entityId,
      operation: scope.operation,
      timestamp: isoNow(),
      fields,
    };
    this.buffers.logs = pushBounded(this.buffers.logs, logEntry);
    process.stdout.write(`${logLineFromEntry(logEntry)}\n`);
  }

  error(scope: ObsScope, message: string, fields: Record<string, LogFieldValue>): void {
    const logEntry: LogEntry = {
      seq: this.nextSeq(),
      level: "error",
      message,
      traceId: scope.traceId,
      model: scope.model,
      entityId: scope.entityId,
      operation: scope.operation,
      timestamp: isoNow(),
      fields,
    };
    this.buffers.logs = pushBounded(this.buffers.logs, logEntry);
    process.stdout.write(`${logLineFromEntry(logEntry)}\n`);
  }

  count(scope: ObsScope, name: string): void {
    if (z.string().min(1).safeParse(name).success === false) {
      throw ValidationError.create("metric name required");
    }
    if (z.string().min(1).safeParse(scope.model).success === false) {
      throw ValidationError.create("metric model required");
    }
    this.record(scope, name, 1);
    this.counterFor(name).add(1, { model: scope.model });
  }

  measure(scope: ObsScope, name: string, metricAmount: number): void {
    if (z.string().min(1).safeParse(name).success === false) {
      throw ValidationError.create("measure name required");
    }
    if (Number.isFinite(metricAmount) === false) {
      return;
    }
    this.record(scope, name, metricAmount);
    this.histogramFor(name).record(metricAmount, { model: scope.model });
  }

  runSpan<T>(
    scope: ObsScope,
    name: string,
    attributes: Attributes,
    run: (span: Span) => Promise<T>,
  ): Promise<T> {
    const startedAt = isoNow();
    const spanAttributes: Attributes = {
      model: scope.model,
      entityId: scope.entityId,
      operation: scope.operation,
      runId: scope.traceId,
    };
    for (const [key, value] of Object.entries(attributes)) {
      spanAttributes[key] = value;
    }
    return this.tracer.startActiveSpan(name, { attributes: spanAttributes }, async (span) => {
      try {
        return await run(span);
      } catch (err) {
        const message = dbErrorMessageForLog(err, "operation failed");
        span.recordException(message);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
        this.buffers.spans = pushBounded(this.buffers.spans, {
          seq: this.nextSeq(),
          name,
          traceId: scope.traceId,
          model: scope.model,
          entityId: scope.entityId,
          operation: scope.operation,
          parentModel: parentModelOf(scope),
          parentEntityId: parentEntityIdOf(scope),
          attributes: textAttributesOf(spanAttributes),
          startedAt,
          endedAt: isoNow(),
        });
      }
    });
  }

  private record(scope: ObsScope, name: string, metricAmount: number): void {
    this.buffers.metrics = pushBounded(this.buffers.metrics, {
      seq: this.nextSeq(),
      entityId: scope.entityId,
      name: `${scope.model.toLowerCase()}.${name}`,
      value: metricAmount,
      traceId: scope.traceId,
      model: scope.model,
      timestamp: isoNow(),
    });
  }

  private counterFor(name: string): Counter {
    if (z.string().min(1).safeParse(name).success === false) {
      throw ValidationError.create("counter name required");
    }
    for (const existing of mapLookup(this.counters, name)) {
      return existing;
    }
    const created = this.meter.createCounter(`fookie.${name}`);
    this.counters.set(name, created);
    return created;
  }

  private histogramFor(name: string): Histogram {
    if (z.string().min(1).safeParse(name).success === false) {
      throw ValidationError.create("histogram name required");
    }
    for (const existing of mapLookup(this.histograms, name)) {
      return existing;
    }
    const created = this.meter.createHistogram(`fookie.${name}`);
    this.histograms.set(name, created);
    return created;
  }
}

export function obsScope(rt: Runtime): ObsScope {
  if (z.string().min(1).safeParse(rt.model.name).success === false) {
    throw ValidationError.create("obs model required");
  }
  if (z.string().min(1).safeParse(rt.operation).success === false) {
    throw ValidationError.create("obs operation required");
  }
  return {
    traceId: rt.traceId,
    model: rt.model.name,
    entityId: rt.entityId,
    operation: rt.operation,
    parent: rt.parent,
  };
}

export type LogLineFieldKinds = {
  log: LogFieldValue;
  text: string;
};

export type LogLineField = LogLineFieldKinds[keyof LogLineFieldKinds];

export function logLineFromEntry(logEntry: LogEntry): string {
  const payload: Record<string, LogLineField> = {
    level: logEntry.level,
    message: logEntry.message,
    traceId: logEntry.traceId,
    model: logEntry.model,
    entityId: logEntry.entityId,
    operation: logEntry.operation,
    timestamp: logEntry.timestamp,
  };
  for (const [key, value] of Object.entries(logEntry.fields)) {
    if (
      key === "level" ||
      key === "message" ||
      key === "traceId" ||
      key === "model" ||
      key === "entityId" ||
      key === "operation" ||
      key === "timestamp"
    ) {
      continue;
    }
    payload[key] = value;
  }
  return JSON.stringify(payload);
}

export type FlowObs = {
  log: (message: string, fields: Record<string, LogFieldValue>) => boolean;
  metric: {
    increment(name: string): boolean;
    histogram(name: string, value: number): boolean;
  };
  trace: <TRes>(name: string, run: () => Promise<TRes>) => Promise<TRes>;
};

export type FlowTelemetry = {
  log: (message: string, fields: Record<string, LogFieldValue>) => boolean;
  increment: (name: string) => boolean;
  histogram: (name: string, metricAmount: number) => boolean;
};

export function createObservability(rt: Runtime): FlowTelemetry {
  const scope = obsScope(rt);
  return {
    log(message: string, fields: Record<string, LogFieldValue>) {
      if (z.string().min(1).safeParse(message).success === false) {
        return false;
      }
      if (z.looseObject({}).safeParse(fields).success === false) {
        return false;
      }
      rt.obs.info(scope, message, fields);
      return true;
    },
    increment(name: string) {
      if (z.string().min(1).safeParse(name).success === false) {
        return false;
      }
      if (z.looseObject({}).safeParse(scope).success === false) {
        return false;
      }
      rt.obs.count(scope, name);
      return true;
    },
    histogram(name: string, metricAmount: number) {
      if (Number.isFinite(metricAmount) === false) {
        return false;
      }
      if (z.string().min(1).safeParse(name).success === false) {
        return false;
      }
      if (z.looseObject({}).safeParse(scope).success === false) {
        return false;
      }
      rt.obs.measure(scope, name, metricAmount);
      return true;
    },
  };
}

export function traceSpan<T>(rt: Runtime, name: string, run: () => Promise<T>): Promise<T> {
  const scope = obsScope(rt);
  if (z.string().min(1).safeParse(name).success === false) {
    throw ValidationError.create("trace span name required");
  }
  const attributes: Attributes = {};
  return rt.obs.runSpan(scope, name, attributes, async (span) => {
    if (z.string().min(1).safeParse(name).success === false) {
      throw ValidationError.create("trace span name required");
    }
    const spanResult = await run();
    if (z.looseObject({}).safeParse(span).success === false) {
      throw ValidationError.create("trace span required");
    }
    span.setAttribute("traceSpan", name);
    return spanResult;
  });
}
