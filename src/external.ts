import { z } from "zod";
import { ValidationError } from "./errors.ts";
import type { InferTypeDef } from "./model.ts";
import type { ScalarSchema, ScalarTypeDef } from "./types/type.ts";
import { isEntityValue } from "./values.ts";
import type { EntityRecord, JsonValue } from "./values.ts";

export type InferExternalInputFrom<I extends Record<string, ScalarTypeDef>> = {
  [K in keyof I]: InferTypeDef<I[K]>;
};

export type InferExternalOutputFrom<O extends Record<string, ScalarTypeDef>> = {
  [K in keyof O]: InferTypeDef<O[K]>;
};

export function parseExternalInput<I extends Record<string, ScalarTypeDef>>(
  fields: I,
  inputJson: JsonValue,
): InferExternalInputFrom<I> {
  if (z.looseObject({}).safeParse(fields).success === false) {
    throw ValidationError.create("invalid external input");
  }
  if (isExternalInput(fields, inputJson) === false) {
    throw ValidationError.create("invalid external input");
  }
  return inputJson;
}

export function isExternalInput<I extends Record<string, ScalarTypeDef>>(
  fields: I,
  inputJson: JsonValue,
): inputJson is InferExternalInputFrom<I> {
  const inputParse = externalFieldsSchema(fields).safeParse(inputJson);
  if (inputParse.success === false) {
    return false;
  }
  for (const [, entryValue] of Object.entries(inputParse.data)) {
    if (isEntityValue(entryValue) === false) {
      return false;
    }
  }
  return true;
}

export function parseExternalOutput<O extends Record<string, ScalarTypeDef>>(
  fields: O,
  outputJson: JsonValue,
): InferExternalOutputFrom<O> {
  if (z.looseObject({}).safeParse(fields).success === false) {
    throw ValidationError.create("invalid external output");
  }
  if (isExternalOutput(fields, outputJson) === false) {
    throw ValidationError.create("invalid external output");
  }
  return outputJson;
}

export function isExternalOutput<O extends Record<string, ScalarTypeDef>>(
  fields: O,
  outputJson: JsonValue,
): outputJson is InferExternalOutputFrom<O> {
  const outputParse = externalFieldsSchema(fields).safeParse(outputJson);
  if (outputParse.success === false) {
    return false;
  }
  for (const [, entryValue] of Object.entries(outputParse.data)) {
    if (isEntityValue(entryValue) === false) {
      return false;
    }
  }
  return true;
}

export type ExternalBackoffKinds = {
  fixed: "fixed";
  exponential: "exponential";
};

export type ExternalBackoff = ExternalBackoffKinds[keyof ExternalBackoffKinds];

export enum FailureClass {
  Transient = "transient",
  Permanent = "permanent",
}

export function isFailureClass(failureValue: string): failureValue is FailureClass {
  if (failureValue === FailureClass.Transient) {
    return true;
  }
  if (failureValue === FailureClass.Permanent) {
    return true;
  }
  return false;
}

export type ExternalCoreConfig<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = {
  name: string;
  input: I;
  output: O;
  attempts: number;
  backoff: ExternalBackoff;
  timeoutMs: number;
};

export type ExternalValidators<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = {
  validateInput(value: JsonValue): InferExternalInputFrom<I>;
  validateOutput(value: JsonValue): InferExternalOutputFrom<O>;
};

export type PlainExternalDef<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = ExternalCoreConfig<I, O> & ExternalValidators<I, O> & { compensate: readonly never[] };

export type CompensatedExternalDef<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = ExternalCoreConfig<I, O> &
  ExternalValidators<I, O> & { compensate: readonly [PlainExternalDef] };

export type ExternalConfigKinds<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = {
  plain: ExternalCoreConfig<I, O>;
  compensated: ExternalCoreConfig<I, O> & { compensate: PlainExternalDef };
};

export type ExternalConfig<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = ExternalConfigKinds<I, O>[keyof ExternalConfigKinds<I, O>];

export type ExternalDefKinds<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = {
  plain: PlainExternalDef<I, O>;
  compensated: CompensatedExternalDef<I, O>;
};

export type ExternalDef<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = ExternalDefKinds<I, O>[keyof ExternalDefKinds<I, O>];

function normalizedAttempts(attempts: number): number {
  if (Number.isInteger(attempts) === false) {
    return 0;
  }
  if (attempts < 1) {
    return 0;
  }
  return attempts;
}

function normalizedBackoff(backoff: ExternalBackoff): ExternalBackoff {
  if (backoff === "exponential") {
    return "exponential";
  }
  if (backoff === "fixed") {
    return "fixed";
  }
  return "fixed";
}

function normalizedTimeoutMs(timeoutMs: number): number {
  if (Number.isFinite(timeoutMs) === false) {
    return 30_000;
  }
  if (timeoutMs < 1) {
    return 30_000;
  }
  return timeoutMs;
}

export function External<
  const I extends Record<string, ScalarTypeDef>,
  const O extends Record<string, ScalarTypeDef>,
>(config: ExternalConfigKinds<I, O>["compensated"]): CompensatedExternalDef<I, O>;
export function External<
  const I extends Record<string, ScalarTypeDef>,
  const O extends Record<string, ScalarTypeDef>,
>(config: ExternalConfigKinds<I, O>["plain"]): PlainExternalDef<I, O>;
export function External<
  const I extends Record<string, ScalarTypeDef>,
  const O extends Record<string, ScalarTypeDef>,
>(config: ExternalConfig<I, O>): ExternalDef<I, O> {
  const attempts = normalizedAttempts(config.attempts);
  const backoff = normalizedBackoff(config.backoff);
  const timeoutMs = normalizedTimeoutMs(config.timeoutMs);
  if ("compensate" in config) {
    return {
      name: config.name,
      input: config.input,
      output: config.output,
      attempts,
      backoff,
      timeoutMs,
      compensate: [config.compensate],
      validateInput: (inputJson: JsonValue) => parseExternalInput(config.input, inputJson),
      validateOutput: (outputJson: JsonValue) => parseExternalOutput(config.output, outputJson),
    };
  }
  return {
    name: config.name,
    input: config.input,
    output: config.output,
    attempts,
    backoff,
    timeoutMs,
    compensate: [],
    validateInput: (inputJson: JsonValue) => parseExternalInput(config.input, inputJson),
    validateOutput: (outputJson: JsonValue) => parseExternalOutput(config.output, outputJson),
  };
}

export type ExternalInputOf<E> =
  E extends ExternalDef<infer I, infer _O> ? InferExternalInputFrom<I> : never;

export type ExternalOutputOf<E> =
  E extends ExternalDef<infer _I, infer O> ? InferExternalOutputFrom<O> : never;

export type ExternalEventPayload = {
  externalId: string;
  name: string;
  input: EntityRecord;
};

export type ExternalEventOf<_E extends ExternalDef = ExternalDef> = ExternalEventPayload;

export function sleep(ms: number): Promise<void> {
  if (Number.isFinite(ms) === false || ms < 1) {
    const resolved = Promise.resolve();
    return resolved;
  }
  return new Promise((resolve) => {
    const delay = Math.floor(ms);
    setTimeout(() => {
      const elapsed = delay;
      if (elapsed < 1) {
        resolve();
        return;
      }
      if (elapsed >= 1) {
        resolve();
      }
    }, delay);
  });
}

export function backoffDelayMs(backoff: ExternalBackoff, attempt: number): number {
  if (backoff === "fixed") {
    return 10;
  }
  if (Number.isInteger(attempt) === false || attempt < 1) {
    return 0;
  }
  const delay = 10 * 2 ** (attempt - 1);
  if (Number.isFinite(delay) === false || delay > 60_000) {
    return 60_000;
  }
  return delay;
}

function externalFieldsSchema<I extends Record<string, ScalarTypeDef>>(fields: I) {
  if (z.looseObject({}).safeParse(fields).success === false) {
    throw ValidationError.create("external fields required");
  }
  const shape: Record<string, ScalarSchema> = {};
  for (const [key, field] of Object.entries(fields)) {
    if (z.string().min(1).safeParse(key).success === false) {
      throw ValidationError.create("external field key required");
    }
    shape[key] = field.schema;
  }
  return z.object(shape);
}
