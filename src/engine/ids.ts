import { z } from "zod";
import { createHash, randomBytes } from "node:crypto";
import type { NestedStepCursor } from "./runtime.ts";
import { ValidationError } from "../errors.ts";
import type { InferExternalInputFrom } from "../external.ts";
import { appendItem } from "../slot.ts";
import type { ScalarTypeDef } from "../types/type.ts";
import { isEntityValue } from "../values.ts";
import type { EntityRecord, EntityValue } from "../values.ts";

export function uuidV7(): string {
  const bytes = randomBytes(16);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ms = BigInt(Date.now());
  view.setUint8(0, Number((ms >> 40n) & 0xffn));
  view.setUint8(1, Number((ms >> 32n) & 0xffn));
  view.setUint8(2, Number((ms >> 24n) & 0xffn));
  view.setUint8(3, Number((ms >> 16n) & 0xffn));
  view.setUint8(4, Number((ms >> 8n) & 0xffn));
  view.setUint8(5, Number(ms & 0xffn));
  view.setUint8(6, (view.getUint8(6) & 0x0f) | 0x70);
  view.setUint8(8, (view.getUint8(8) & 0x3f) | 0x80);
  const hex = Array.from(bytes, (uuidByte) => uuidByte.toString(16).padStart(2, "0")).reduce(
    (hexAcc, hexPair) => `${hexAcc}${hexPair}`,
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function derivedUuid(seed: string): string {
  if (z.string().min(1).safeParse(seed).success === false) {
    throw ValidationError.create("derived uuid seed required");
  }
  const bytes = createHash("sha256").update(seed).digest().subarray(0, 16);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint8(6, (view.getUint8(6) & 0x0f) | 0x80);
  view.setUint8(8, (view.getUint8(8) & 0x3f) | 0x80);
  const hex = Array.from(bytes, (uuidByte) => uuidByte.toString(16).padStart(2, "0")).reduce(
    (hexAcc, hexPair) => `${hexAcc}${hexPair}`,
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nestedEntityId(
  cursor: NestedStepCursor,
  parentEntityId: string,
  modelName: string,
): string {
  if (z.string().min(1).safeParse(parentEntityId).success === false) {
    throw ValidationError.create("nested entity parent id required");
  }
  if (z.string().min(1).safeParse(modelName).success === false) {
    throw ValidationError.create("nested entity model name required");
  }
  if (Number.isInteger(cursor.steps) === false || cursor.steps < 0) {
    throw ValidationError.create("nested step cursor invalid");
  }
  const step = cursor.steps;
  cursor.steps = step + 1;
  return derivedUuid(`${parentEntityId}:${modelName}:${step}`);
}

export function externalStepId(
  cursor: NestedStepCursor,
  runId: string,
  entityId: string,
  name: string,
): StepIdentity {
  if (z.string().min(1).safeParse(runId).success === false) {
    throw ValidationError.create("external step run id required");
  }
  if (z.string().min(1).safeParse(entityId).success === false) {
    throw ValidationError.create("external step entity id required");
  }
  if (z.string().min(1).safeParse(name).success === false) {
    throw ValidationError.create("external step name required");
  }
  if (Number.isInteger(cursor.steps) === false || cursor.steps < 0) {
    throw ValidationError.create("step cursor invalid");
  }
  const stepIndex = cursor.steps;
  cursor.steps = stepIndex + 1;
  return {
    externalId: `v2:${runId}:${entityId}:${stepIndex}:${name}`,
    stepIndex,
  };
}

export type StepIdentity = {
  externalId: string;
  stepIndex: number;
};

export function compensationStepId(forwardExternalId: string, name: string): string {
  if (z.string().min(1).safeParse(forwardExternalId).success === false) {
    throw ValidationError.create("compensation forward id required");
  }
  if (z.string().min(1).safeParse(name).success === false) {
    throw ValidationError.create("compensation name required");
  }
  return `${forwardExternalId}:undo:${name}`;
}

export function inputFingerprint<I extends Record<string, ScalarTypeDef>>(
  input: InferExternalInputFrom<I>,
): string {
  const record: EntityRecord = input;
  let inputEntries: ReadonlyArray<[string, EntityValue]> = [];
  for (const [key, value] of Object.entries(record)) {
    if (isEntityValue(value)) {
      inputEntries = appendItem(inputEntries, [key, value]);
    }
  }
  const orderedEntries = inputEntries.toSorted((left, right) => {
    const [leftKey] = left;
    const [rightKey] = right;
    if (leftKey < rightKey) {
      return -1;
    }
    if (leftKey > rightKey) {
      return 1;
    }
    return 0;
  });
  let parts: readonly string[] = [];
  for (const [key, value] of orderedEntries) {
    parts = appendItem(parts, `${key}=${JSON.stringify(value)}`);
  }
  return parts.join(",");
}
