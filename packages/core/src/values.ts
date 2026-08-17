import { z } from "zod";
import { ValidationError } from "./errors.ts";
import { isCoordinate } from "./pg/encode.ts";
import { appendItem } from "./slot.ts";

export type Coordinate = readonly [number, number];

export type EntityValueByKind = {
  text: string;
  number: number;
  flag: boolean;
  point: Coordinate;
};

export type EntityValue = EntityValueByKind[keyof EntityValueByKind];

export type EntityRecord = Record<string, EntityValue>;

export type JsonValueForms = [
  string,
  number,
  boolean,
  readonly JsonValue[],
  { readonly [key: string]: JsonValue },
];

export type JsonValue = JsonValueForms[number];

export type JsonObject = { readonly [key: string]: JsonValue };

export type HostValueKinds = {
  json: JsonValue;
  entity: EntityValue;
  date: Date;
  buffer: Buffer;
  error: Error;
};

export type HostValue = HostValueKinds[keyof HostValueKinds];

export type CaughtFailureKinds = {
  error: Error;
  text: string;
  number: number;
  boolean: boolean;
};

export type CaughtFailure = CaughtFailureKinds[keyof CaughtFailureKinds];

export type WritableJsonObject = { [key: string]: JsonValue };

export const jsonWireSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(jsonWireSchema),
    z.record(z.string(), jsonWireSchema),
  ]),
);

export type FilterGroupByName = {
  numeric: "numeric";
  bigint: "bigint";
  decimal: "decimal";
  string: "string";
  uuid: "uuid";
  boolean: "boolean";
  temporal: "temporal";
  coordinate: "coordinate";
  json: "json";
  geometric: "geometric";
  binary: "binary";
};

export type FilterGroup = FilterGroupByName[keyof FilterGroupByName];

export function isPlainRecord(hostValue: HostValue): hostValue is JsonObject {
  if (Array.isArray(hostValue) === true) {
    return false;
  }
  if (
    hostValue instanceof Date ||
    hostValue instanceof Error ||
    Buffer.isBuffer(hostValue) === true
  ) {
    return false;
  }
  const tag = Object.prototype.toString.call(hostValue);
  if (tag !== "[object Object]") {
    return false;
  }
  return true;
}

export function isJsonObject(hostValue: HostValue): hostValue is JsonObject {
  if (isPlainRecord(hostValue) === false) {
    return false;
  }
  for (const [, entry] of Object.entries(hostValue)) {
    if (Array.isArray(entry) === true) {
      continue;
    }
    if (isPlainRecord(entry) === true) {
      continue;
    }
    if (z.union([z.string(), z.number(), z.boolean()]).safeParse(entry).success === false) {
      return false;
    }
  }
  return true;
}

export type CopyJsonSourceKinds = {
  json: JsonObject;
  entity: EntityRecord;
};

export type CopyJsonSource = CopyJsonSourceKinds[keyof CopyJsonSourceKinds];

export function copyJsonObject(source: CopyJsonSource): WritableJsonObject {
  if (z.looseObject({}).safeParse(source).success === false) {
    throw ValidationError.create("record source required");
  }
  const next: WritableJsonObject = {};
  for (const [key, value] of Object.entries(source)) {
    if (z.string().min(1).safeParse(key).success === false) {
      throw ValidationError.create("record key required");
    }
    next[key] = value;
  }
  return next;
}

export function mergeEntityRecords(left: EntityRecord, right: EntityRecord): EntityRecord {
  if (z.looseObject({}).safeParse(left).success === false) {
    throw ValidationError.create("left record required");
  }
  if (z.looseObject({}).safeParse(right).success === false) {
    throw ValidationError.create("right record required");
  }
  const next = copyJsonObject(left);
  for (const [key, value] of Object.entries(right)) {
    next[key] = value;
  }
  return entityRecordFromPlain(next);
}

export function isEntityValue(hostValue: HostValue): hostValue is EntityValue {
  if (z.union([z.string(), z.boolean()]).safeParse(hostValue).success === true) {
    return true;
  }
  const numberParsed = z.number().safeParse(hostValue);
  if (numberParsed.success === true) {
    return Number.isFinite(numberParsed.data);
  }
  return isCoordinate(hostValue);
}

export function entityValueAt(entity: EntityRecord, key: string): EntityValue[] {
  let found: readonly EntityValue[] = [];
  for (const [entryKey, value] of Object.entries(entity)) {
    if (entryKey === key) {
      if (isEntityValue(value) === true) {
        found = appendItem(found, value);
      }
      break;
    }
  }
  return found.slice();
}

export type EntityRecordSourceKinds = {
  json: JsonObject;
  entity: EntityRecord;
  writable: WritableJsonObject;
  entityMap: Record<string, EntityValue>;
};

export type EntityRecordSource = EntityRecordSourceKinds[keyof EntityRecordSourceKinds];

export function entityRecordFromPlain(raw: EntityRecordSource): EntityRecord {
  const wireParsed = z.record(z.string(), jsonWireSchema).safeParse(raw);
  if (wireParsed.success === false) {
    throw ValidationError.create("entity record required");
  }
  const entity: EntityRecord = {};
  for (const [key, value] of Object.entries(wireParsed.data)) {
    if (isEntityValue(value)) {
      entity[key] = value;
    }
  }
  return entity;
}

export function jsonObjectFromHost(raw: HostValue): readonly JsonObject[] {
  const jsonTextParsed = z.string().safeParse(raw);
  if (jsonTextParsed.success === true) {
    try {
      const parsed = JSON.parse(jsonTextParsed.data);
      if (isJsonObject(parsed) === false) {
        return [];
      }
      return [parsed];
    } catch {
      return [];
    }
  }
  if (isJsonObject(raw) === false) {
    return [];
  }
  return [raw];
}

export function jsonObjectFromRecord(raw: unknown): JsonObject {
  const parsed = z.record(z.string(), jsonWireSchema).safeParse(raw);
  if (parsed.success === false) {
    throw ValidationError.create("record required");
  }
  return parsed.data;
}

export function entityRecordFromJson(raw: HostValue): readonly EntityRecord[] {
  const jsonTextParsed = z.string().safeParse(raw);
  if (jsonTextParsed.success === true) {
    try {
      const parsed = JSON.parse(jsonTextParsed.data);
      if (isJsonObject(parsed) === false && z.string().safeParse(parsed).success === false) {
        return [];
      }
      return entityRecordFromJson(parsed);
    } catch {
      return [];
    }
  }
  if (isPlainRecord(raw) === false) {
    return [];
  }
  const entity: EntityRecord = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isEntityValue(value) === false) {
      return [];
    }
    entity[key] = value;
  }
  return [entity];
}
