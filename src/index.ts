import { z } from "zod";
import { randomBytes } from "node:crypto";
import http from "node:http";
import pg from "pg";
import { metrics as otelMetrics, SpanStatusCode, trace } from "@opentelemetry/api";
import type { Attributes, Counter, Histogram, Span } from "@opentelemetry/api";

export type DoneSignal = "done";
export type RunningSignal = "running";
export type FailedSignal = "failed";
export const Done: DoneSignal = "done";
export const Running: RunningSignal = "running";
export const Failed: FailedSignal = "failed";
type SignalByName = {
  done: DoneSignal;
  running: RunningSignal;
  failed: FailedSignal;
};
export type Signal = SignalByName[keyof SignalByName];

export type OutboxPendingStatus = "pending";
export type OutboxFailedStatus = "failed";
export type OutboxCompletedStatus = "completed";
export const OutboxPending: OutboxPendingStatus = "pending";
export const OutboxFailed: OutboxFailedStatus = "failed";
export const OutboxCompleted: OutboxCompletedStatus = "completed";
type OutboxStatusByName = {
  pending: OutboxPendingStatus;
  failed: OutboxFailedStatus;
  completed: OutboxCompletedStatus;
};
export type OutboxStatus = OutboxStatusByName[keyof OutboxStatusByName];

function requireErrorMessage(message: string): string {
  const parsed = z.string().min(1).safeParse(message);
  if (parsed.success === false) {
    throw new Error("fookie error message must be non-empty");
  }
  if (parsed.data.length < 1) {
    throw new Error("fookie error message must be non-empty");
  }
  return parsed.data;
}

export class FookieError extends Error {
  protected static override create(message: string): FookieError {
    const safeMessage = requireErrorMessage(message);
    super(safeMessage);
    this.name = new.target.name;
    if (this.name.length < 1) {
      throw new Error("fookie error name must be non-empty");
    }
    if (this.message !== safeMessage) {
      throw new Error("fookie error message failed to apply");
    }
  }

  static create(message: string): FookieError {
    const safeMessage = requireErrorMessage(message);
    const err = new FookieError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("FookieError.create message mismatch");
    }
    if (err.name !== "FookieError") {
      throw new Error("FookieError.create name mismatch");
    }
    return err;
  }
}

export class PgEncodeError extends FookieError {
  private constructor(message: string) {
    super(message);
    if (this.name !== "PgEncodeError") {
      throw new Error("PgEncodeError name failed to apply");
    }
    if (this.message.length < 1) {
      throw new Error("PgEncodeError message must be non-empty");
    }
  }

  static override create(message: string): PgEncodeError {
    const safeMessage = requireErrorMessage(message);
    const err = new PgEncodeError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("PgEncodeError.create message mismatch");
    }
    if (err.name !== "PgEncodeError") {
      throw new Error("PgEncodeError.create name mismatch");
    }
    return err;
  }
}

export class ModelFieldError extends FookieError {
  private constructor(message: string) {
    super(message);
    if (this.name !== "ModelFieldError") {
      throw new Error("ModelFieldError name failed to apply");
    }
    if (this.message.length < 1) {
      throw new Error("ModelFieldError message must be non-empty");
    }
  }

  static override create(message: string): ModelFieldError {
    const safeMessage = requireErrorMessage(message);
    const err = new ModelFieldError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("ModelFieldError.create message mismatch");
    }
    if (err.name !== "ModelFieldError") {
      throw new Error("ModelFieldError.create name mismatch");
    }
    return err;
  }
}

export class NotFoundError extends FookieError {
  private constructor(message: string) {
    super(message);
    if (this.name !== "NotFoundError") {
      throw new Error("NotFoundError name failed to apply");
    }
    if (this.message.length < 1) {
      throw new Error("NotFoundError message must be non-empty");
    }
  }

  static override create(message: string): NotFoundError {
    const safeMessage = requireErrorMessage(message);
    const err = new NotFoundError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("NotFoundError.create message mismatch");
    }
    if (err.name !== "NotFoundError") {
      throw new Error("NotFoundError.create name mismatch");
    }
    return err;
  }
}

export class ValidationError extends FookieError {
  private constructor(message: string) {
    super(message);
    if (this.name !== "ValidationError") {
      throw new Error("ValidationError name failed to apply");
    }
    if (this.message.length < 1) {
      throw new Error("ValidationError message must be non-empty");
    }
  }

  static override create(message: string): ValidationError {
    const safeMessage = requireErrorMessage(message);
    const err = new ValidationError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("ValidationError.create message mismatch");
    }
    if (err.name !== "ValidationError") {
      throw new Error("ValidationError.create name mismatch");
    }
    return err;
  }
}

export class DatabaseError extends FookieError {
  private constructor(message: string) {
    super(message);
    if (this.name !== "DatabaseError") {
      throw new Error("DatabaseError name failed to apply");
    }
    if (this.message.length < 1) {
      throw new Error("DatabaseError message must be non-empty");
    }
  }

  static override create(message: string): DatabaseError {
    const safeMessage = requireErrorMessage(message);
    const err = new DatabaseError(safeMessage);
    if (err.message !== safeMessage) {
      throw new Error("DatabaseError.create message mismatch");
    }
    if (err.name !== "DatabaseError") {
      throw new Error("DatabaseError.create name mismatch");
    }
    return err;
  }
}

export type Coordinate = readonly [number, number];

type EntityValueByKind = {
  text: string;
  number: number;
  flag: boolean;
  point: Coordinate;
};
export type EntityValue = EntityValueByKind[keyof EntityValueByKind];

export type EntityRecord = Record<string, EntityValue>;

type JsonValueForms = [
  string,
  number,
  boolean,
  readonly JsonValue[],
  { readonly [key: string]: JsonValue },
];
export type JsonValue = JsonValueForms[number];

export type JsonObject = { readonly [key: string]: JsonValue };

type HostValueKinds = {
  json: JsonValue;
  entity: EntityValue;
  date: Date;
  buffer: Buffer;
  error: Error;
};
type HostValue = HostValueKinds[keyof HostValueKinds];

type CaughtFailureKinds = {
  error: Error;
  text: string;
  number: number;
  boolean: boolean;
};
type CaughtFailure = CaughtFailureKinds[keyof CaughtFailureKinds];

type WritableJsonObject = { [key: string]: JsonValue };

const jsonWireSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(jsonWireSchema),
    z.record(z.string(), jsonWireSchema),
  ]),
);


type FilterGroupByName = {
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

type TypeMeta = {
  unique: boolean;
  index: boolean;
  min: number;
  max: number;
};

type Scalar = EntityValue;

type ScalarSchema = z.ZodType<Scalar, Scalar>;

function typeMeta(unique: boolean, index: boolean, min: number, max: number): TypeMeta {
  const nextMeta: TypeMeta = {
    unique,
    index,
    min,
    max,
  };
  if (unique !== true && unique !== false) {
    throw ModelFieldError.create("type meta unique must be boolean");
  }
  if (index !== true && index !== false) {
    throw ModelFieldError.create("type meta index must be boolean");
  }
  return nextMeta;
}

function defaultMeta(): TypeMeta {
  const uniqueFlag = false;
  const indexFlag = false;
  const minBound = -1;
  const maxBound = -1;
  const meta = typeMeta(uniqueFlag, indexFlag, minBound, maxBound);
  if (meta.min !== -1 || meta.max !== -1) {
    throw ModelFieldError.create("default type meta bounds must be unset");
  }
  return meta;
}

export class PlainType<T extends Scalar, G extends FilterGroup> {
  readonly schema: ScalarSchema & z.ZodType<T, T>;
  readonly kind: string;
  readonly filterGroup: G;
  readonly meta: TypeMeta;

  private constructor(
    schema: z.ZodType<T, T>,
    kind: string,
    filterGroup: G,
    meta: TypeMeta,
  ) {
    const kindParsed = z.string().min(1).safeParse(kind);
    if (kindParsed.success === false) {
      throw ModelFieldError.create("plain type kind required");
    }
    this.schema = schema;
    this.kind = kindParsed.data;
    this.filterGroup = filterGroup;
    this.meta = meta;
  }

  static create<T extends Scalar, G extends FilterGroup>(
    schema: z.ZodType<T, T>,
    kind: string,
    filterGroup: G,
    meta: TypeMeta = defaultMeta(),
  ): PlainType<T, G> {
    const nextType = new PlainType(schema, kind, filterGroup, meta);
    if (nextType.kind.length < 1) {
      throw ModelFieldError.create("plain type kind required");
    }
    if (nextType.filterGroup !== filterGroup) {
      throw ModelFieldError.create("plain type filter group failed to apply");
    }
    return nextType;
  }

  unique(): PlainType<T, G> {
    const nextMeta = typeMeta(true, this.meta.index, this.meta.min, this.meta.max);
    const nextType = PlainType.create(this.schema, this.kind, this.filterGroup, nextMeta);
    if (nextType.meta.unique !== true) {
      throw ModelFieldError.create("unique meta failed to apply");
    }
    if (nextType.kind !== this.kind) {
      throw ModelFieldError.create("unique must keep type kind");
    }
    return nextType;
  }

  index(): PlainType<T, G> {
    const nextMeta = typeMeta(this.meta.unique, true, this.meta.min, this.meta.max);
    const nextType = PlainType.create(this.schema, this.kind, this.filterGroup, nextMeta);
    if (nextType.meta.index !== true) {
      throw ModelFieldError.create("index meta failed to apply");
    }
    if (nextType.kind !== this.kind) {
      throw ModelFieldError.create("index must keep type kind");
    }
    return nextType;
  }
}

export class NumericType {
  readonly filterGroup: "numeric" = "numeric";
  readonly schema: z.ZodNumber;
  readonly kind: string;
  readonly meta: TypeMeta;

  private constructor(schema: z.ZodNumber, kind: string, meta: TypeMeta) {
    const kindParsed = z.string().min(1).safeParse(kind);
    if (kindParsed.success === false) {
      throw ModelFieldError.create("numeric type kind required");
    }
    this.schema = schema;
    this.kind = kindParsed.data;
    this.meta = meta;
  }

  static create(
    schema: z.ZodNumber,
    kind: string,
    meta: TypeMeta = defaultMeta(),
  ): NumericType {
    const nextType = new NumericType(schema, kind, meta);
    if (nextType.kind.length < 1) {
      throw ModelFieldError.create("numeric type kind required");
    }
    if (nextType.filterGroup !== "numeric") {
      throw ModelFieldError.create("numeric type filter group must be numeric");
    }
    return nextType;
  }

  unique(): NumericType {
    const nextMeta = typeMeta(true, this.meta.index, this.meta.min, this.meta.max);
    const nextType = NumericType.create(this.schema, this.kind, nextMeta);
    if (nextType.meta.unique !== true) {
      throw ModelFieldError.create("unique meta failed to apply");
    }
    if (nextType.kind !== this.kind) {
      throw ModelFieldError.create("unique must keep type kind");
    }
    return nextType;
  }

  index(): NumericType {
    const nextMeta = typeMeta(this.meta.unique, true, this.meta.min, this.meta.max);
    const nextType = NumericType.create(this.schema, this.kind, nextMeta);
    if (nextType.meta.index !== true) {
      throw ModelFieldError.create("index meta failed to apply");
    }
    if (nextType.kind !== this.kind) {
      throw ModelFieldError.create("index must keep type kind");
    }
    return nextType;
  }

  min(n: number): NumericType {
    const parsed = z.number().finite().safeParse(n);
    if (parsed.success === false) {
      throw ModelFieldError.create("numeric min requires finite number");
    }
    const nextMeta = typeMeta(this.meta.unique, this.meta.index, parsed.data, this.meta.max);
    const nextSchema = this.schema.min(parsed.data);
    const nextType = NumericType.create(nextSchema, this.kind, nextMeta);
    if (nextType.meta.min !== parsed.data) {
      throw ModelFieldError.create("numeric min failed to apply");
    }
    return nextType;
  }

  max(n: number): NumericType {
    const parsed = z.number().finite().safeParse(n);
    if (parsed.success === false) {
      throw ModelFieldError.create("numeric max requires finite number");
    }
    const nextMeta = typeMeta(this.meta.unique, this.meta.index, this.meta.min, parsed.data);
    const nextSchema = this.schema.max(parsed.data);
    const nextType = NumericType.create(nextSchema, this.kind, nextMeta);
    if (nextType.meta.max !== parsed.data) {
      throw ModelFieldError.create("numeric max failed to apply");
    }
    return nextType;
  }
}
export type NumericTypeDef = NumericType;
type PlainTypeDef<T extends Scalar, G extends FilterGroup> = PlainType<T, G>;
type CoordinateTypeDef = PlainType<Coordinate, "coordinate">;

type ScalarTypeDefByKind = {
  numeric: NumericType;
  text: PlainType<string, FilterGroup>;
  flag: PlainType<boolean, "boolean">;
  point: CoordinateTypeDef;
};
export type ScalarTypeDef = ScalarTypeDefByKind[keyof ScalarTypeDefByKind];

export type TypeDef<T extends Scalar = Scalar> = T extends number
  ? NumericType
  : T extends Coordinate
    ? CoordinateTypeDef
    : T extends boolean
      ? PlainType<boolean, "boolean">
      : PlainType<string, FilterGroup>;

const coordinateSchema: z.ZodType<Coordinate, Coordinate> = z.tuple([
  z.number().finite(),
  z.number().finite(),
]);

const uuidSchema = z.string().uuid();
const bigintSchema = z.string().regex(/^-?\d+$/);
const decimalSchema = z.string().regex(/^-?\d+(\.\d+)?$/);
const dateSchema = z.iso.date();
const timeSchema = z.iso.time();
const timetzSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3])(?::[0-5]\d)?)$/);
const intervalSchema = z
  .string()
  .regex(
    /^-?\d+ (years?|months?|mons?|days?|hours?|minutes?|mins?|seconds?|secs?)( -?\d+ (years?|months?|mons?|days?|hours?|minutes?|mins?|seconds?|secs?))*$/,
  );
function ipv4HostOk(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return false;
  }
  for (const part of parts) {
    if (/^\d{1,3}$/.test(part) === false) {
      return false;
    }
    if (part.length > 1 && part.startsWith("0") === true) {
      return false;
    }
    const n = Number(part);
    if (n < 0 || n > 255) {
      return false;
    }
  }
  return true;
}

function ipv6HostOk(host: string): boolean {
  if (host.includes(":") === false) {
    return false;
  }
  if (/[^0-9a-fA-F:]/.test(host) === true) {
    return false;
  }
  const sides = host.split("::");
  if (sides.length > 2) {
    return false;
  }
  let groupCount = 0;
  for (const side of sides) {
    if (side.length < 1) {
      continue;
    }
    const groups = side.split(":");
    for (const group of groups) {
      if (group.length < 1 || group.length > 4) {
        return false;
      }
      if (/^[0-9a-fA-F]+$/.test(group) === false) {
        return false;
      }
      groupCount += 1;
    }
  }
  if (sides.length === 1) {
    return groupCount === 8;
  }
  return groupCount <= 7;
}

function prefixLenOk(text: string, max: number): boolean {
  if (/^\d+$/.test(text) === false) {
    return false;
  }
  if (text.length > 1 && text.startsWith("0") === true) {
    return false;
  }
  const prefix = Number(text);
  return Number.isInteger(prefix) === true && prefix >= 0 && prefix <= max;
}

function ipv4ToUint(host: string): readonly number[] {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return [];
  }
  let packed = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (Number.isInteger(octet) === false || octet < 0 || octet > 255) {
      return [];
    }
    packed = (packed << 8) + octet;
  }
  return [packed >>> 0];
}

function ipv4CidrNetworkOk(host: string, prefix: number): boolean {
  for (const addr of ipv4ToUint(host)) {
    if (prefix === 0) {
      return addr === 0;
    }
    if (prefix < 1 || prefix > 32) {
      return false;
    }
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (addr & ~mask) === 0;
  }
  return false;
}

function inetValueOk(inetLiteral: string): boolean {
  const slash = inetLiteral.indexOf("/");
  let host = inetLiteral;
  let prefixHits: readonly string[] = [];
  if (slash !== -1) {
    host = inetLiteral.slice(0, slash);
    prefixHits = [inetLiteral.slice(slash + 1)];
  }
  if (ipv4HostOk(host) === true) {
    for (const prefixText of prefixHits) {
      return prefixLenOk(prefixText, 32);
    }
    return true;
  }
  if (ipv6HostOk(host) === true) {
    for (const prefixText of prefixHits) {
      return prefixLenOk(prefixText, 128);
    }
    return true;
  }
  return false;
}

function cidrValueOk(cidrLiteral: string): boolean {
  const slash = cidrLiteral.indexOf("/");
  if (slash === -1) {
    return false;
  }
  const host = cidrLiteral.slice(0, slash);
  const prefixText = cidrLiteral.slice(slash + 1);
  if (ipv4HostOk(host) === true) {
    if (prefixLenOk(prefixText, 32) === false) {
      return false;
    }
    return ipv4CidrNetworkOk(host, Number(prefixText));
  }
  if (ipv6HostOk(host) === true) {
    return prefixLenOk(prefixText, 128);
  }
  return false;
}

function macaddrValueOk(macaddrText: string): boolean {
  if (/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(macaddrText) === true) {
    return true;
  }
  if (/^([0-9a-fA-F]{2}-){5}[0-9a-fA-F]{2}$/.test(macaddrText) === true) {
    return true;
  }
  return /^[0-9a-fA-F]{12}$/.test(macaddrText) === true;
}

const inetSchema = z.string().refine(inetValueOk);
const cidrSchema = z.string().refine(cidrValueOk);
const macaddrSchema = z.string().refine(macaddrValueOk);
const byteaSchema = z.string().regex(/^\\x(?:[0-9a-fA-F]{2})*$/);
const geometricFloat = "[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?";
const geometricPoint = `\\(${geometricFloat},${geometricFloat}\\)`;
const lineSchema = z
  .string()
  .regex(new RegExp(`^\\{${geometricFloat},${geometricFloat},${geometricFloat}\\}$`));
const lsegSchema = z.string().regex(new RegExp(`^\\[${geometricPoint},${geometricPoint}\\]$`));
const boxSchema = z.string().regex(new RegExp(`^${geometricPoint},${geometricPoint}$`));
const pathSchema = z
  .string()
  .regex(new RegExp(`^[\\[\\(](?:${geometricPoint},)*${geometricPoint}[\\]\\)]$`));
const polygonSchema = z
  .string()
  .regex(new RegExp(`^\\((?:${geometricPoint},)+${geometricPoint}\\)$`));
const circleSchema = z.string().regex(new RegExp(`^<${geometricPoint},${geometricFloat}>$`));
const geometricValueSchema = z.union([
  lineSchema,
  lsegSchema,
  boxSchema,
  pathSchema,
  polygonSchema,
  circleSchema,
]);
const xmlSchema = z.string().refine((xmlText) => {
  const trimmed = xmlText.trim();
  if (trimmed.length < 3) {
    return false;
  }
  if (trimmed.startsWith("<") === false) {
    return false;
  }
  if (trimmed.endsWith(">") === false) {
    return false;
  }
  if (/<[A-Za-z_?]/.test(trimmed) === false) {
    return false;
  }
  return true;
});
const jsonSchema = z.string().refine((jsonText) => {
  if (jsonText.trim().length < 1) {
    return false;
  }
  try {
    JSON.parse(jsonText);
    return true;
  } catch {
    return false;
  }
});
const temporalFilterValue = z.union([
  dateSchema,
  timeSchema,
  timetzSchema,
  z.iso.datetime(),
  intervalSchema,
]);

export const Types = {
  smallint: NumericType.create(z.number().int().min(-32768).max(32767), "smallint"),
  integer: NumericType.create(z.number().int(), "integer"),
  int: NumericType.create(z.number().int(), "integer"),
  bigint: PlainType.create(bigintSchema, "bigint", "bigint"),
  numeric: PlainType.create(decimalSchema, "numeric", "decimal"),
  real: NumericType.create(z.number().finite(), "real"),
  float: NumericType.create(z.number().finite(), "real"),
  doublePrecision: NumericType.create(z.number().finite(), "doublePrecision"),
  serial: NumericType.create(z.number().int().positive(), "serial"),
  bigserial: PlainType.create(bigintSchema, "bigserial", "bigint"),
  text: PlainType.create(z.string(), "text", "string"),
  string: PlainType.create(z.string(), "text", "string"),
  varchar: (length: number) => {
    if (Number.isInteger(length) === false || length < 1) {
      return PlainType.create(
        z.string().refine(() => false),
        `varchar(${length})`,
        "string",
      );
    }
    return PlainType.create(z.string().max(length), `varchar(${length})`, "string");
  },
  char: (length: number) => {
    if (Number.isInteger(length) === false || length < 1) {
      return PlainType.create(
        z.string().refine(() => false),
        `char(${length})`,
        "string",
      );
    }
    return PlainType.create(z.string().length(length), `char(${length})`, "string");
  },
  boolean: PlainType.create(z.boolean(), "boolean", "boolean"),
  bool: PlainType.create(z.boolean(), "boolean", "boolean"),
  uuid: PlainType.create(uuidSchema, "uuid", "uuid"),
  id: PlainType.create(uuidSchema, "id", "uuid"),
  date: PlainType.create(dateSchema, "date", "temporal"),
  time: PlainType.create(timeSchema, "time", "temporal"),
  timetz: PlainType.create(timetzSchema, "timetz", "temporal"),
  timestamp: PlainType.create(z.iso.datetime({ local: true }), "timestamp", "temporal"),
  timestamptz: PlainType.create(z.iso.datetime({ offset: true }), "timestamptz", "temporal"),
  datetime: PlainType.create(z.iso.datetime({ local: true }), "timestamp", "temporal"),
  interval: PlainType.create(intervalSchema, "interval", "temporal"),
  json: PlainType.create(jsonSchema, "json", "json"),
  jsonb: PlainType.create(jsonSchema, "jsonb", "json"),
  bytea: PlainType.create(byteaSchema, "bytea", "binary"),
  inet: PlainType.create(inetSchema, "inet", "string"),
  cidr: PlainType.create(cidrSchema, "cidr", "string"),
  macaddr: PlainType.create(macaddrSchema, "macaddr", "string"),
  money: PlainType.create(decimalSchema, "money", "decimal"),
  currency: NumericType.create(z.number().finite().nonnegative(), "currency"),
  point: PlainType.create(coordinateSchema, "point", "coordinate"),
  coordinate: PlainType.create(coordinateSchema, "point", "coordinate"),
  line: PlainType.create(lineSchema, "line", "geometric"),
  lseg: PlainType.create(lsegSchema, "lseg", "geometric"),
  box: PlainType.create(boxSchema, "box", "geometric"),
  path: PlainType.create(pathSchema, "path", "geometric"),
  polygon: PlainType.create(polygonSchema, "polygon", "geometric"),
  circle: PlainType.create(circleSchema, "circle", "geometric"),
  xml: PlainType.create(xmlSchema, "xml", "string"),
  email: PlainType.create(z.string().refine(emailValueOk), "email", "string"),
  url: PlainType.create(z.string().refine(urlValueOk), "url", "string"),
  enum(
    first: string,
    second?: string,
    third?: string,
    fourth?: string,
    fifth?: string,
    sixth?: string,
    seventh?: string,
    eighth?: string,
    ninth?: string,
    tenth?: string,
  ): PlainType<string, "string"> {
    let values: readonly string[] = [];
    const candidates = [
      first,
      second,
      third,
      fourth,
      fifth,
      sixth,
      seventh,
      eighth,
      ninth,
      tenth,
    ];
    for (const candidate of candidates) {
      const candidateParsed = z.string().min(1).safeParse(candidate);
      if (candidateParsed.success === false) {
        continue;
      }
      values = appendItem(values, candidateParsed.data);
    }
    if (values.length < 1) {
      throw ModelFieldError.create("enum requires at least one value");
    }
    const enumSchema = z.string().refine((candidate) => {
      if (z.string().min(1).safeParse(candidate).success === false) {
        return false;
      }
      for (const enumMember of values) {
        if (candidate === enumMember) {
          return true;
        }
      }
      return false;
    });
    const enumType = PlainType.create(enumSchema, "enum", "string");
    return enumType;
  },
  relation<T extends { name: string }>(model: T): PlainType<string, "uuid"> {
    if (z.looseObject({}).safeParse(model).success === false) {
      throw ModelFieldError.create("relation model required");
    }
    if (z.string().min(1).safeParse(model.name).success === false) {
      throw ModelFieldError.create("relation model name required");
    }
    const kind = `relation:${model.name}`;
    const relationType = PlainType.create(uuidSchema, kind, "uuid");
    return relationType;
  },
};

function emailValueOk(emailText: string): boolean {
  if (z.string().email().safeParse(emailText).success === false) {
    return false;
  }
  const at = emailText.lastIndexOf("@");
  if (at < 0) {
    return false;
  }
  const domain = emailText.slice(at + 1);
  for (const label of domain.split(".")) {
    if (label.length < 1) {
      return false;
    }
    if (label.startsWith("-") === true || label.endsWith("-") === true) {
      return false;
    }
  }
  return true;
}

function urlValueOk(urlText: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlText);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }
  if (parsed.hostname.length < 1) {
    return false;
  }
  if (parsed.hostname === ".") {
    return false;
  }
  return true;
}

export type ModelRef = {
  name: string;
};

type FieldSlotKinds = {
  scalar: ScalarTypeDef;
  ref: ModelRef;
  model: ModelDef<ModelFieldsInput>;
};

type FieldValue = FieldSlotKinds[keyof FieldSlotKinds];

export type FieldsMap = {
  [key: string]: FieldValue;
};

type ModelFieldKinds = {
  scalar: ScalarTypeDef;
  ref: ModelRef;
};

function isModelRef(fieldDef: FieldValue): fieldDef is FieldSlotKinds["ref"] {
  if ("name" in fieldDef === false) {
    return false;
  }
  if ("schema" in fieldDef) {
    return false;
  }
  if ("flow" in fieldDef) {
    return false;
  }
  return true;
}

function isRelationField(
  fieldDef: FieldValue,
): fieldDef is FieldSlotKinds[Exclude<keyof FieldSlotKinds, "scalar">] {
  if (isModelRef(fieldDef) === true) {
    return true;
  }
  if ("flow" in fieldDef === false) {
    return false;
  }
  if ("fields" in fieldDef === false) {
    return false;
  }
  return true;
}

function fieldSchema(fieldDef: FieldValue): ScalarSchema {
  if (isRelationField(fieldDef) === true) {
    return uuidSchema;
  }
  const schema = fieldDef.schema;
  if (z.looseObject({}).safeParse(schema).success === false) {
    throw ModelFieldError.create("field schema required");
  }
  return schema;
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

function domainFieldsSchema(fields: FieldsMap) {
  if (z.looseObject({}).safeParse(fields).success === false) {
    throw ValidationError.create("domain fields required");
  }
  const shape: Record<string, ScalarSchema> = {};
  for (const [key, fieldDef] of Object.entries(fields)) {
    if (z.string().min(1).safeParse(key).success === false) {
      throw ValidationError.create("domain field key required");
    }
    shape[key] = fieldSchema(fieldDef);
  }
  return z.object(shape);
}

function partialFieldsSchema(fields: FieldsMap) {
  const domainSchema = domainFieldsSchema(fields);
  const partialSchema = domainSchema.partial();
  let fieldKeys: readonly string[] = [];
  for (const key of Object.keys(domainSchema.shape)) {
    fieldKeys = appendItem(fieldKeys, key);
  }
  if (fieldKeys.length < 1) {
    const emptyProbe = partialSchema.safeParse({});
    if (emptyProbe.success === false) {
      throw ValidationError.create("partial fields schema invalid");
    }
    return partialSchema;
  }
  const probe = partialSchema.safeParse({});
  if (probe.success === false) {
    throw ValidationError.create("partial fields schema invalid");
  }
  return partialSchema;
}

type InferTypeDef<D extends ScalarTypeDef> = D extends NumericTypeDef
  ? number
  : D extends CoordinateTypeDef
    ? Coordinate
    : D extends PlainTypeDef<infer T, infer _G>
      ? T
      : never;

type OrderedBoundKinds = {
  number: number;
  text: string;
};

type OrderedBound = OrderedBoundKinds[keyof OrderedBoundKinds];

type FilterOpBag = {
  eq: EntityValue;
  ne: EntityValue;
  gt: OrderedBound;
  gte: OrderedBound;
  lt: OrderedBound;
  lte: OrderedBound;
  like: string;
  ilike: string;
  startsWith: string;
  endsWith: string;
  in: readonly EntityValue[];
  contains: string;
  near: readonly [number, number, number];
};

export type FilterFieldInput = {
  [K in keyof FilterOpBag]?: FilterOpBag[K];
};

export type FilterInput = Record<string, FilterFieldInput>;

const filterCoordinateValue = z.tuple([z.number().finite(), z.number().finite()]);
const filterNearValue = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite().nonnegative(),
]);

function zodPartialObject<T extends z.ZodRawShape>(shape: T) {
  const objectSchema = z.object(shape);
  const partialSchema = objectSchema.partial();
  const probe = partialSchema.safeParse({});
  if (probe.success === false) {
    throw ValidationError.create("partial object schema invalid");
  }
  return partialSchema;
}

function compareNumberFilterSchema() {
  return zodPartialObject({
    eq: z.number().finite(),
    ne: z.number().finite(),
    gt: z.number().finite(),
    gte: z.number().finite(),
    lt: z.number().finite(),
    lte: z.number().finite(),
    in: z.array(z.number().finite()),
  });
}

function compareBigintFilterSchema() {
  return zodPartialObject({
    eq: bigintSchema,
    ne: bigintSchema,
    gt: bigintSchema,
    gte: bigintSchema,
    lt: bigintSchema,
    lte: bigintSchema,
    in: z.array(bigintSchema),
  });
}

function compareDecimalFilterSchema() {
  return zodPartialObject({
    eq: decimalSchema,
    ne: decimalSchema,
    gt: decimalSchema,
    gte: decimalSchema,
    lt: decimalSchema,
    lte: decimalSchema,
    in: z.array(decimalSchema),
  });
}

function stringPatternFilterSchema() {
  return zodPartialObject({
    eq: z.string(),
    ne: z.string(),
    gt: z.string(),
    gte: z.string(),
    lt: z.string(),
    lte: z.string(),
    like: z.string(),
    ilike: z.string(),
    startsWith: z.string(),
    endsWith: z.string(),
    in: z.array(z.string()),
  });
}

function uuidFilterSchema() {
  const eqSchema = z.string().uuid();
  const neSchema = z.string().uuid();
  const inSchema = z.array(z.string().uuid());
  if (z.looseObject({}).safeParse(eqSchema).success === false) {
    throw ValidationError.create("uuid filter schema required");
  }
  return zodPartialObject({
    eq: eqSchema,
    ne: neSchema,
    in: inSchema,
  });
}

function booleanFilterSchema() {
  const eqSchema = z.boolean();
  const neSchema = z.boolean();
  if (z.looseObject({}).safeParse(eqSchema).success === false) {
    throw ValidationError.create("boolean filter schema required");
  }
  return zodPartialObject({
    eq: eqSchema,
    ne: neSchema,
  });
}

function coordinateFilterSchema() {
  const eqSchema = filterCoordinateValue;
  const neSchema = filterCoordinateValue;
  const nearSchema = filterNearValue;
  if (z.looseObject({}).safeParse(eqSchema).success === false) {
    throw ValidationError.create("coordinate filter schema required");
  }
  return zodPartialObject({
    eq: eqSchema,
    ne: neSchema,
    near: nearSchema,
  });
}

function jsonFilterSchema() {
  const eqSchema = jsonSchema;
  const neSchema = jsonSchema;
  const containsSchema = z.string();
  if (z.looseObject({}).safeParse(eqSchema).success === false) {
    throw ValidationError.create("json filter schema required");
  }
  return zodPartialObject({
    eq: eqSchema,
    ne: neSchema,
    contains: containsSchema,
  });
}

function geometricFilterSchema() {
  const eqSchema = geometricValueSchema;
  const neSchema = geometricValueSchema;
  if (z.looseObject({}).safeParse(eqSchema).success === false) {
    throw ValidationError.create("geometric filter schema required");
  }
  return zodPartialObject({
    eq: eqSchema,
    ne: neSchema,
  });
}

function temporalFilterSchema() {
  return zodPartialObject({
    eq: temporalFilterValue,
    ne: temporalFilterValue,
    gt: temporalFilterValue,
    gte: temporalFilterValue,
    lt: temporalFilterValue,
    lte: temporalFilterValue,
    in: z.array(temporalFilterValue),
  });
}

function binaryFilterSchema() {
  const eqSchema = byteaSchema;
  const neSchema = byteaSchema;
  if (z.looseObject({}).safeParse(eqSchema).success === false) {
    throw ValidationError.create("binary filter schema required");
  }
  return zodPartialObject({
    eq: eqSchema,
    ne: neSchema,
  });
}

function filterFieldSchemaFor(group: FilterGroup) {
  switch (group) {
    case "numeric":
      return compareNumberFilterSchema();
    case "bigint":
      return compareBigintFilterSchema();
    case "decimal":
      return compareDecimalFilterSchema();
    case "string":
      return stringPatternFilterSchema();
    case "uuid":
      return uuidFilterSchema();
    case "boolean":
      return booleanFilterSchema();
    case "temporal":
      return temporalFilterSchema();
    case "coordinate":
      return coordinateFilterSchema();
    case "json":
      return jsonFilterSchema();
    case "geometric":
      return geometricFilterSchema();
    case "binary":
      return binaryFilterSchema();
  }
}

function buildFilterSchema(fields: FieldsMap) {
  if (z.looseObject({}).safeParse(fields).success === false) {
    throw ValidationError.create("filter fields required");
  }
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, fieldDef] of Object.entries(fields)) {
    if (z.string().min(1).safeParse(key).success === false) {
      throw ValidationError.create("filter field key required");
    }
    shape[key] = filterFieldSchemaFor(filterGroupOf(fieldDef));
  }
  return zodPartialObject(shape);
}

function filterGroupOf(fieldDef: FieldValue): FilterGroup {
  if (isRelationField(fieldDef) === true) {
    return "uuid";
  }
  const group = fieldDef.filterGroup;
  if (z.string().min(1).safeParse(group).success === false) {
    throw ModelFieldError.create("filter group required");
  }
  return group;
}

type EqNeOps<V, Self> = {
  eq(value: V): Self;
  ne(value: V): Self;
};

type CompareExtras<V, Self> = {
  gt(value: V): Self;
  gte(value: V): Self;
  lt(value: V): Self;
  lte(value: V): Self;
};

type InOps<V, Self> = {
  in(values: readonly V[]): Self;
};

type StringPatternOps<Self> = {
  like(value: string): Self;
  ilike(value: string): Self;
  startsWith(value: string): Self;
  endsWith(value: string): Self;
};

interface NumericFieldFilterOps
  extends
    EqNeOps<number, NumericFieldFilterOps>,
    CompareExtras<number, NumericFieldFilterOps>,
    InOps<number, NumericFieldFilterOps> {}
interface BigintFieldFilterOps
  extends
    EqNeOps<string, BigintFieldFilterOps>,
    CompareExtras<string, BigintFieldFilterOps>,
    InOps<string, BigintFieldFilterOps> {}
interface DecimalFieldFilterOps
  extends
    EqNeOps<string, DecimalFieldFilterOps>,
    CompareExtras<string, DecimalFieldFilterOps>,
    InOps<string, DecimalFieldFilterOps> {}
interface StringFieldFilterOps
  extends
    EqNeOps<string, StringFieldFilterOps>,
    CompareExtras<string, StringFieldFilterOps>,
    StringPatternOps<StringFieldFilterOps>,
    InOps<string, StringFieldFilterOps> {}
interface UuidFieldFilterOps
  extends EqNeOps<string, UuidFieldFilterOps>, InOps<string, UuidFieldFilterOps> {}
interface BoolFieldFilterOps extends EqNeOps<boolean, BoolFieldFilterOps> {}
interface TemporalFieldFilterOps
  extends EqNeOps<string, TemporalFieldFilterOps>, CompareExtras<string, TemporalFieldFilterOps> {}
interface CoordinateFieldFilterOps extends EqNeOps<Coordinate, CoordinateFieldFilterOps> {
  near(x: number, y: number, meters: number): CoordinateFieldFilterOps;
}
interface JsonFieldFilterOps extends EqNeOps<string, JsonFieldFilterOps> {
  contains(value: string): JsonFieldFilterOps;
}
interface GeometricFieldFilterOps extends EqNeOps<string, GeometricFieldFilterOps> {}
interface BinaryFieldFilterOps extends EqNeOps<string, BinaryFieldFilterOps> {}

type FilterOpsForGroup<G extends FilterGroup> = G extends "numeric"
  ? NumericFieldFilterOps
  : G extends "bigint"
    ? BigintFieldFilterOps
    : G extends "decimal"
      ? DecimalFieldFilterOps
      : G extends "string"
        ? StringFieldFilterOps
        : G extends "uuid"
          ? UuidFieldFilterOps
          : G extends "boolean"
            ? BoolFieldFilterOps
            : G extends "temporal"
              ? TemporalFieldFilterOps
              : G extends "coordinate"
                ? CoordinateFieldFilterOps
                : G extends "json"
                  ? JsonFieldFilterOps
                  : G extends "geometric"
                    ? GeometricFieldFilterOps
                    : G extends "binary"
                      ? BinaryFieldFilterOps
                      : never;

type FilterOpsForField<V extends FieldValue> = V extends {
  filterGroup: infer G extends FilterGroup;
}
  ? FilterOpsForGroup<G>
  : V extends ModelRef
    ? UuidFieldFilterOps
    : never;

export type FilterFor<F extends FieldsMap> = {
  [K in keyof F]: FilterOpsForField<F[K]>;
};

type FilterState = FilterInput;

type RuntimeFilterOps = {
  eq(value: EntityValue): RuntimeFilterOps;
  ne(value: EntityValue): RuntimeFilterOps;
  gt(value: OrderedBound): RuntimeFilterOps;
  gte(value: OrderedBound): RuntimeFilterOps;
  lt(value: OrderedBound): RuntimeFilterOps;
  lte(value: OrderedBound): RuntimeFilterOps;
  like(value: string): RuntimeFilterOps;
  ilike(value: string): RuntimeFilterOps;
  startsWith(value: string): RuntimeFilterOps;
  endsWith(value: string): RuntimeFilterOps;
  in(values: readonly EntityValue[]): RuntimeFilterOps;
  contains(value: string): RuntimeFilterOps;
  near(x: number, y: number, meters: number): RuntimeFilterOps;
};

export type FilterView<_F extends FieldsMap = FieldsMap> = {
  [key: string]: RuntimeFilterOps;
};

type FilterOpValueKinds = {
  entity: EntityValue;
  number: number;
  text: string;
  list: readonly EntityValue[];
  coordinate: Coordinate;
  near: readonly [number, number, number];
};

type FilterOpValue = FilterOpValueKinds[keyof FilterOpValueKinds];

function writeFilterFieldOp(field: FilterFieldInput, op: string, opOperand: FilterOpValue): void {
  if (z.string().min(1).safeParse(op).success === false) {
    throw ValidationError.create("filter op required");
  }
  if (z.looseObject({}).safeParse(field).success === false) {
    throw ValidationError.create("filter field required");
  }
  const record: Record<string, FilterOpValue> = field;
  record[op] = opOperand;
}

function copyFilterOpOperand(opValue: FilterOpValue): FilterOpValue {
  if (Array.isArray(opValue) === true) {
    const nearParsed = filterNearValue.safeParse(opValue);
    if (nearParsed.success === true) {
      const pointX = nearParsed.data[0];
      const pointY = nearParsed.data[1];
      const pointMeters = nearParsed.data[2];
      const nearOperand: readonly [number, number, number] = [pointX, pointY, pointMeters];
      return nearOperand;
    }
    const coordParsed = filterCoordinateValue.safeParse(opValue);
    if (coordParsed.success === true) {
      const coordX = coordParsed.data[0];
      const coordY = coordParsed.data[1];
      const coordinate: Coordinate = [coordX, coordY];
      return coordinate;
    }
    let listed: readonly EntityValue[] = [];
    for (const listItem of opValue) {
      if (isEntityValue(listItem) === false) {
        throw ValidationError.create("filter in value required");
      }
      listed = appendItem(listed, listItem);
    }
    return listed;
  }
  return opValue;
}

function copyFilterField(source: FilterFieldInput): FilterFieldInput {
  const next: FilterFieldInput = {};
  if ("eq" in source) {
    const eqParsed = jsonWireSchema.safeParse(source.eq);
    if (eqParsed.success === false || isEntityValue(eqParsed.data) === false) {
      throw ValidationError.create("filter eq required");
    }
    writeFilterFieldOp(next, "eq", copyFilterOpOperand(eqParsed.data));
  }
  if ("ne" in source) {
    const neParsed = jsonWireSchema.safeParse(source.ne);
    if (neParsed.success === false || isEntityValue(neParsed.data) === false) {
      throw ValidationError.create("filter ne required");
    }
    writeFilterFieldOp(next, "ne", copyFilterOpOperand(neParsed.data));
  }
  if ("gt" in source) {
    const boundParsed = z.union([z.number().finite(), z.string()]).safeParse(source.gt);
    if (boundParsed.success === false) {
      throw ValidationError.create("filter gt required");
    }
    writeFilterFieldOp(next, "gt", copyFilterOpOperand(boundParsed.data));
  }
  if ("gte" in source) {
    const boundParsed = z.union([z.number().finite(), z.string()]).safeParse(source.gte);
    if (boundParsed.success === false) {
      throw ValidationError.create("filter gte required");
    }
    writeFilterFieldOp(next, "gte", copyFilterOpOperand(boundParsed.data));
  }
  if ("lt" in source) {
    const boundParsed = z.union([z.number().finite(), z.string()]).safeParse(source.lt);
    if (boundParsed.success === false) {
      throw ValidationError.create("filter lt required");
    }
    writeFilterFieldOp(next, "lt", copyFilterOpOperand(boundParsed.data));
  }
  if ("lte" in source) {
    const boundParsed = z.union([z.number().finite(), z.string()]).safeParse(source.lte);
    if (boundParsed.success === false) {
      throw ValidationError.create("filter lte required");
    }
    writeFilterFieldOp(next, "lte", copyFilterOpOperand(boundParsed.data));
  }
  if ("like" in source) {
    const textParsed = z.string().safeParse(source.like);
    if (textParsed.success === false) {
      throw ValidationError.create("filter like required");
    }
    writeFilterFieldOp(next, "like", copyFilterOpOperand(textParsed.data));
  }
  if ("ilike" in source) {
    const textParsed = z.string().safeParse(source.ilike);
    if (textParsed.success === false) {
      throw ValidationError.create("filter ilike required");
    }
    writeFilterFieldOp(next, "ilike", copyFilterOpOperand(textParsed.data));
  }
  if ("startsWith" in source) {
    const textParsed = z.string().safeParse(source.startsWith);
    if (textParsed.success === false) {
      throw ValidationError.create("filter startsWith required");
    }
    writeFilterFieldOp(next, "startsWith", copyFilterOpOperand(textParsed.data));
  }
  if ("endsWith" in source) {
    const textParsed = z.string().safeParse(source.endsWith);
    if (textParsed.success === false) {
      throw ValidationError.create("filter endsWith required");
    }
    writeFilterFieldOp(next, "endsWith", copyFilterOpOperand(textParsed.data));
  }
  if ("contains" in source) {
    const textParsed = z.string().safeParse(source.contains);
    if (textParsed.success === false) {
      throw ValidationError.create("filter contains required");
    }
    writeFilterFieldOp(next, "contains", copyFilterOpOperand(textParsed.data));
  }
  if ("in" in source) {
    const listParsed = z.array(z.union([z.string(), z.number(), z.boolean()])).safeParse(source.in);
    if (listParsed.success === false) {
      throw ValidationError.create("filter in required");
    }
    writeFilterFieldOp(next, "in", copyFilterOpOperand(listParsed.data));
  }
  if ("near" in source) {
    const nearParsed = filterNearValue.safeParse(source.near);
    if (nearParsed.success === false) {
      throw ValidationError.create("filter near required");
    }
    writeFilterFieldOp(next, "near", copyFilterOpOperand(nearParsed.data));
  }
  return next;
}

function filterFieldFromState(state: FilterState, key: string): FilterFieldInput[] {
  let found: readonly FilterFieldInput[] = [];
  for (const [entryKey, entryValue] of Object.entries(state)) {
    if (entryKey === key) {
      found = appendItem(found, entryValue);
      break;
    }
  }
  return found.slice();
}

function assignFilterOp(state: FilterState, key: string, op: string, opOperand: FilterOpValue) {
  if (z.string().min(1).safeParse(key).success === false) {
    throw ValidationError.create("filter key required");
  }
  if (z.string().min(1).safeParse(op).success === false) {
    throw ValidationError.create("filter op required");
  }
  let next: FilterFieldInput = {};
  for (const existing of filterFieldFromState(state, key)) {
    next = copyFilterField(existing);
  }
  writeFilterFieldOp(next, op, opOperand);
  state[key] = next;
}

type FilterOpsConfig = {
  compare: boolean;
  stringPattern: boolean;
  inList: boolean;
  contains: boolean;
  near: boolean;
};

function buildRuntimeFilterOps(
  state: FilterState,
  key: string,
  config: FilterOpsConfig,
): RuntimeFilterOps {
  const set = (op: string, opOperand: FilterOpValue, enabled: boolean): RuntimeFilterOps => {
    if (z.string().min(1).safeParse(op).success === false) {
      throw ValidationError.create("filter op required");
    }
    if (enabled === true) {
      assignFilterOp(state, key, op, opOperand);
    }
    return ops;
  };
  const ops: RuntimeFilterOps = {
    eq: (filterOperand) => set("eq", filterOperand, true),
    ne: (filterOperand) => set("ne", filterOperand, true),
    gt: (filterOperand) => set("gt", filterOperand, config.compare),
    gte: (filterOperand) => set("gte", filterOperand, config.compare),
    lt: (filterOperand) => set("lt", filterOperand, config.compare),
    lte: (filterOperand) => set("lte", filterOperand, config.compare),
    like: (filterOperand) => set("like", filterOperand, config.stringPattern),
    ilike: (filterOperand) => set("ilike", filterOperand, config.stringPattern),
    startsWith: (filterOperand) => set("startsWith", filterOperand, config.stringPattern),
    endsWith: (filterOperand) => set("endsWith", filterOperand, config.stringPattern),
    in: (filterOperands) => set("in", filterOperands, config.inList),
    contains: (filterOperand) => set("contains", filterOperand, config.contains),
    near: (x, y, meters) => {
      const nearParsed = filterNearValue.safeParse([x, y, meters]);
      if (nearParsed.success === false) {
        throw ModelFieldError.create("near requires finite x, y, meters>=0");
      }
      const pointX = nearParsed.data[0];
      const pointY = nearParsed.data[1];
      const pointMeters = nearParsed.data[2];
      const nearOperand: readonly [number, number, number] = [pointX, pointY, pointMeters];
      return set("near", nearOperand, config.near);
    },
  };
  return ops;
}

function filterOpsConfig(
  compare: boolean,
  stringPattern: boolean,
  inList: boolean,
  contains: boolean,
  near: boolean,
): FilterOpsConfig {
  return {
    compare,
    stringPattern,
    inList,
    contains,
    near,
  };
}

const noFilterOps: FilterOpsConfig = filterOpsConfig(false, false, false, false, false);

const filterOpsConfigByGroup: Record<FilterGroup, FilterOpsConfig> = {
  numeric: filterOpsConfig(true, false, true, false, false),
  bigint: filterOpsConfig(true, false, true, false, false),
  decimal: filterOpsConfig(true, false, true, false, false),
  temporal: filterOpsConfig(true, false, true, false, false),
  string: filterOpsConfig(true, true, true, false, false),
  uuid: filterOpsConfig(false, false, true, false, false),
  boolean: noFilterOps,
  coordinate: filterOpsConfig(false, false, false, false, true),
  json: filterOpsConfig(false, false, false, true, false),
  geometric: noFilterOps,
  binary: noFilterOps,
};

function filterOpsConfigForGroup(group: FilterGroup): FilterOpsConfig {
  if (group === "numeric") {
    return filterOpsConfigByGroup.numeric;
  }
  if (group === "bigint") {
    return filterOpsConfigByGroup.bigint;
  }
  if (group === "decimal") {
    return filterOpsConfigByGroup.decimal;
  }
  if (group === "temporal") {
    return filterOpsConfigByGroup.temporal;
  }
  if (group === "string") {
    return filterOpsConfigByGroup.string;
  }
  if (group === "uuid") {
    return filterOpsConfigByGroup.uuid;
  }
  if (group === "boolean") {
    return filterOpsConfigByGroup.boolean;
  }
  if (group === "coordinate") {
    return filterOpsConfigByGroup.coordinate;
  }
  if (group === "json") {
    return filterOpsConfigByGroup.json;
  }
  if (group === "geometric") {
    return filterOpsConfigByGroup.geometric;
  }
  return filterOpsConfigByGroup.binary;
}

const compareBoundShape = z.union([z.number(), z.string()]);

function filterClauseUnsupported(group: FilterGroup, clause: FilterFieldInput): boolean {
  const config = filterOpsConfigForGroup(group);
  if (
    compareBoundShape.safeParse(clause.gt).success === true ||
    compareBoundShape.safeParse(clause.gte).success === true ||
    compareBoundShape.safeParse(clause.lt).success === true ||
    compareBoundShape.safeParse(clause.lte).success === true
  ) {
    if (config.compare === false) {
      return true;
    }
  }
  if (
    z.string().safeParse(clause.like).success === true ||
    z.string().safeParse(clause.ilike).success === true ||
    z.string().safeParse(clause.startsWith).success === true ||
    z.string().safeParse(clause.endsWith).success === true
  ) {
    if (config.stringPattern === false) {
      return true;
    }
  }
  if (Array.isArray(clause.in) && config.inList === false) {
    return true;
  }
  if (z.string().safeParse(clause.contains).success === true && config.contains === false) {
    return true;
  }
  if (Array.isArray(clause.near) && config.near === false) {
    return true;
  }
  return false;
}

function createFilter<F extends FieldsMap>(_fields: F, state: FilterState): FilterView<F> {
  const view: FilterView<F> = {};
  for (const [key, value] of Object.entries(_fields)) {
    const group = filterGroupOf(value);
    const config = filterOpsConfigForGroup(group);
    view[key] = buildRuntimeFilterOps(state, key, config);
  }
  return view;
}

function isPlainRecord(hostValue: HostValue): hostValue is JsonObject {
  if (Array.isArray(hostValue) === true) {
    return false;
  }
  if (hostValue instanceof Date || hostValue instanceof Error || Buffer.isBuffer(hostValue) === true) {
    return false;
  }
  const tag = Object.prototype.toString.call(hostValue);
  if (tag !== "[object Object]") {
    return false;
  }
  return true;
}

function isJsonObject(hostValue: HostValue): hostValue is JsonObject {
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

function mapLookup<K, V>(map: Map<K, V>, key: K): V[] {
  let found: readonly V[] = [];
  for (const [entryKey, entryValue] of map) {
    if (entryKey === key) {
      found = appendItem(found, entryValue);
      break;
    }
  }
  return found.slice();
}

function catchValidation<T>(run: () => T): T[] {
  try {
    const runOutput = run();
    return appendItem([], runOutput);
  } catch (err) {
    if (err instanceof ValidationError) {
      return [];
    }
    throw err;
  }
}

function parseBodyRecord(schema: z.ZodObject<z.ZodRawShape>, bodyJson: JsonValue): EntityRecord {
  const bodyParse = schema.safeParse(bodyJson);
  if (bodyParse.success === false) {
    throw ValidationError.create("invalid body");
  }
  const wireParsed = z.record(z.string(), jsonWireSchema).safeParse(bodyParse.data);
  if (wireParsed.success === false) {
    throw ValidationError.create("invalid body");
  }
  for (const [, entryValue] of Object.entries(wireParsed.data)) {
    if (isEntityValue(entryValue) === false) {
      throw ValidationError.create("invalid body field");
    }
  }
  return entityRecordFromPlain(wireParsed.data);
}

function parseFilter(schema: z.ZodObject<z.ZodRawShape>, filterJson: JsonValue): FilterInput {
  const filterParse = schema.safeParse(filterJson);
  if (filterParse.success === false) {
    throw ValidationError.create("invalid filter");
  }
  const record: FilterInput = {};
  for (const [key, entry] of Object.entries(filterParse.data)) {
    const entryWire = jsonWireSchema.safeParse(entry);
    if (entryWire.success === false) {
      continue;
    }
    if (isPlainRecord(entryWire.data)) {
      record[key] = entryWire.data;
    }
  }
  return record;
}

type InferExternalInputFrom<I extends Record<string, ScalarTypeDef>> = {
  [K in keyof I]: InferTypeDef<I[K]>;
};

type InferExternalOutputFrom<O extends Record<string, ScalarTypeDef>> = {
  [K in keyof O]: InferTypeDef<O[K]>;
};

type ModelFieldsInput = Record<string, ModelFieldKinds[keyof ModelFieldKinds]>;

type SystemFieldKeyKinds = {
  id: "id";
  createdAt: "createdAt";
  updatedAt: "updatedAt";
  isDeleted: "isDeleted";
};

type SystemFieldKey = SystemFieldKeyKinds[keyof SystemFieldKeyKinds];

const systemFieldDefs = {
  id: Types.id,
  createdAt: Types.datetime,
  updatedAt: Types.datetime,
  isDeleted: Types.bool,
};

type SystemFieldsMap = {
  id: TypeDef<string>;
  createdAt: TypeDef<string>;
  updatedAt: TypeDef<string>;
  isDeleted: TypeDef<boolean>;
};

type NormalizeModelFields<F extends ModelFieldsInput> = {
  [K in keyof F]: F[K] extends ScalarTypeDef ? F[K] : ModelRef;
};

type EntityFieldsOf<D extends ModelFieldsInput> = NormalizeModelFields<D> & SystemFieldsMap;

export type InferCreateBody<D extends ModelFieldsInput> = InferFields<NormalizeModelFields<D>>;

export type ModelEntity<D extends ModelFieldsInput> = InferCreateBody<D> & {
  id: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
};

function isSystemFieldKey(key: string): key is SystemFieldKey {
  if (key === "id") {
    return true;
  }
  if (key === "createdAt") {
    return true;
  }
  if (key === "updatedAt") {
    return true;
  }
  if (key === "isDeleted") {
    return true;
  }
  return false;
}

export type InferDomainBody<D extends ModelFieldsInput> = InferCreateBody<D>;

export type EntityOf<F extends FieldsMap> = InferFields<F>;

function domainFieldsFrom(fields: FieldsMap): FieldsMap {
  const domain: Record<string, FieldValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (isSystemFieldKey(key) === false) {
      domain[key] = value;
    }
  }
  return domain;
}

function mergeFieldsMaps(left: FieldsMap, right: FieldsMap): FieldsMap {
  const merged: Record<string, FieldValue> = {};
  for (const [key, value] of Object.entries(left)) {
    merged[key] = value;
  }
  for (const [key, value] of Object.entries(right)) {
    merged[key] = value;
  }
  return merged;
}

function isCreateBody<D extends ModelFieldsInput>(
  model: ModelDef<D>,
  record: EntityRecord,
): record is InferCreateBody<D> {
  try {
    model.validateCreateBody(record);
    return true;
  } catch (err) {
    if (err instanceof ValidationError) {
      return false;
    }
    throw err;
  }
}

function isModelEntity<D extends ModelFieldsInput>(
  model: ModelDef<D>,
  record: EntityRecord,
): record is ModelEntity<D> {
  if (z.string().min(1).safeParse(record.id).success === false) {
    return false;
  }
  if (z.string().min(1).safeParse(record.createdAt).success === false) {
    return false;
  }
  if (z.string().min(1).safeParse(record.updatedAt).success === false) {
    return false;
  }
  if (z.boolean().safeParse(record.isDeleted).success === false) {
    return false;
  }
  const domain = domainFieldsFrom(model.fields);
  const domainBody: EntityRecord = {};
  for (const [key, value] of Object.entries(record)) {
    if (key in domain === true && isEntityValue(value) === true) {
      domainBody[key] = value;
    }
  }
  if (isCreateBody(model, domainBody) === false) {
    return false;
  }
  return true;
}

function mergeUpdateBody<D extends ModelFieldsInput>(
  model: ModelDef<D>,
  record: EntityRecord,
): EntityRecord {
  const domain = domainFieldsFrom(model.fields);
  const merged: EntityRecord = {};
  for (const [key, value] of Object.entries(record)) {
    if (key in domain === false) {
      continue;
    }
    if (isEntityValue(value)) {
      merged[key] = value;
    }
  }
  return merged;
}

type CopyJsonSourceKinds = {
  json: JsonObject;
  entity: EntityRecord;
};
type CopyJsonSource = CopyJsonSourceKinds[keyof CopyJsonSourceKinds];

function copyJsonObject(source: CopyJsonSource): WritableJsonObject {
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

function mergeEntityRecords(left: EntityRecord, right: EntityRecord): EntityRecord {
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

function createdEntity(entityId: string, body: EntityRecord): EntityRecord {
  const now = isoNow();
  const entity = copyJsonObject(body);
  entity.id = entityId;
  entity.createdAt = now;
  entity.updatedAt = now;
  entity.isDeleted = false;
  return entityRecordFromPlain(entity);
}

function isoNow(): string {
  const now = new Date();
  if (Number.isFinite(now.getTime()) === false) {
    throw ValidationError.create("iso timestamp invalid");
  }
  const iso = now.toISOString();
  if (z.string().datetime().safeParse(iso).success === false) {
    throw ValidationError.create("iso timestamp invalid");
  }
  return iso;
}

function stampUpdate(existing: EntityRecord, domain: EntityRecord): EntityRecord {
  const merged = copyJsonObject(existing);
  for (const [key, value] of Object.entries(domain)) {
    if (isSystemFieldKey(key) === false) {
      merged[key] = value;
    }
  }
  merged.updatedAt = isoNow();
  return entityRecordFromPlain(merged);
}

function stampSoftDelete(entity: EntityRecord): EntityRecord {
  if (z.looseObject({}).safeParse(entity).success === false) {
    throw ValidationError.create("entity required for soft delete");
  }
  const next = copyJsonObject(entity);
  next.isDeleted = true;
  const stampedAt = isoNow();
  if (z.string().min(1).safeParse(stampedAt).success === false) {
    throw ValidationError.create("soft delete timestamp required");
  }
  next.updatedAt = stampedAt;
  return entityRecordFromPlain(next);
}

function entityStoreKey(modelName: string, entityId: string): string {
  if (z.string().min(1).safeParse(modelName).success === false) {
    throw ModelFieldError.create("model name required for entity store key");
  }
  if (z.string().min(1).safeParse(entityId).success === false) {
    throw ModelFieldError.create("entity id required for entity store key");
  }
  const key = `${modelName}:${entityId}`;
  return key;
}

type PgQueryable = {
  query: pg.Pool["query"];
};

type PgClient = PgQueryable & { release: () => void };

export type InjectablePool = PgQueryable & {
  connect: () => Promise<PgClient>;
  end: readonly (() => Promise<void>)[];
};

function wrapOwnedPool(connectionString: string): InjectablePool {
  if (z.string().min(1).safeParse(connectionString).success === false) {
    throw ValidationError.create("database connection string required");
  }
  const rawPool = new pg.Pool({ connectionString });
  const closePool = () => rawPool.end();
  return {
    query: rawPool.query.bind(rawPool),
    connect: () => rawPool.connect(),
    end: [closePool],
  };
}

function requireInjectedPool(pools: readonly InjectablePool[]): InjectablePool {
  for (const pool of pools) {
    if (z.looseObject({}).safeParse(pool).success === false) {
      throw ValidationError.create("injected pool invalid");
    }
    return pool;
  }
  throw ValidationError.create("injected pool required");
}

const outboxTableName = "public.fookie_outbox";

function toSnakeCase(key: string): string {
  if (z.string().min(1).safeParse(key).success === false) {
    throw ModelFieldError.create("key required for snake_case");
  }
  const snake = key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
  if (snake.length < 1) {
    throw ModelFieldError.create("snake_case conversion failed");
  }
  return snake;
}

function toCamelCase(key: string): string {
  if (z.string().min(1).safeParse(key).success === false) {
    throw ModelFieldError.create("camelCase key required");
  }
  return key.replace(/_([a-z])/g, (whole, letter: string) => {
    const letterParsed = z.string().min(1).safeParse(letter);
    if (letterParsed.success === false) {
      return whole;
    }
    if (letterParsed.data.length < 1) {
      return whole;
    }
    return letterParsed.data.toUpperCase();
  });
}

function tableNameFor(modelName: string): string {
  if (z.string().min(1).safeParse(modelName).success === false) {
    throw ModelFieldError.create("model name required for table name");
  }
  const table = toSnakeCase(modelName);
  if (z.string().min(1).safeParse(table).success === false) {
    throw ModelFieldError.create("table name required");
  }
  return table;
}

function columnNameFor(fieldKey: string): string {
  if (z.string().min(1).safeParse(fieldKey).success === false) {
    throw ModelFieldError.create("field key required for column name");
  }
  const column = toSnakeCase(fieldKey);
  if (z.string().min(1).safeParse(column).success === false) {
    throw ModelFieldError.create("column name required");
  }
  return column;
}

function pgColumnType(field: FieldValue): string {
  if (isRelationField(field)) {
    return "UUID";
  }
  const group = field.filterGroup;
  const kind = field.kind;
  if (group === "numeric") {
    if (kind === "smallint") {
      return "SMALLINT";
    }
    if (kind === "integer" || kind === "int" || kind === "serial") {
      return "INTEGER";
    }
    if (kind === "currency" || kind === "money") {
      return "NUMERIC";
    }
    if (kind === "doublePrecision") {
      return "DOUBLE PRECISION";
    }
    return "REAL";
  }
  if (group === "bigint" || group === "decimal") {
    return "NUMERIC";
  }
  if (group === "boolean") {
    return "BOOLEAN";
  }
  if (group === "uuid") {
    return "UUID";
  }
  if (group === "temporal") {
    if (kind === "date") {
      return "DATE";
    }
    if (kind === "time") {
      return "TIME";
    }
    if (kind === "timetz") {
      return "TIMETZ";
    }
    if (kind === "timestamp" || kind === "datetime") {
      return "TIMESTAMP";
    }
    if (kind === "interval") {
      return "INTERVAL";
    }
    return "TIMESTAMPTZ";
  }
  if (group === "coordinate") {
    return "POINT";
  }
  if (group === "json") {
    if (kind === "json") {
      return "JSON";
    }
    return "JSONB";
  }
  if (group === "binary") {
    return "BYTEA";
  }
  if (group === "geometric") {
    if (kind === "line") {
      return "LINE";
    }
    if (kind === "lseg") {
      return "LSEG";
    }
    if (kind === "box") {
      return "BOX";
    }
    if (kind === "path") {
      return "PATH";
    }
    if (kind === "polygon") {
      return "POLYGON";
    }
    if (kind === "circle") {
      return "CIRCLE";
    }
  }
  if (kind === "inet") {
    return "INET";
  }
  if (kind === "cidr") {
    return "CIDR";
  }
  if (kind === "macaddr") {
    return "MACADDR";
  }
  if (kind === "xml") {
    return "XML";
  }
  if (kind.startsWith("varchar(") === true && kind.endsWith(")") === true) {
    const length = kind.slice(8, -1);
    if (/^[1-9]\d*$/.test(length) === true) {
      return `VARCHAR(${length})`;
    }
  }
  if (kind.startsWith("char(") === true && kind.endsWith(")") === true) {
    const length = kind.slice(5, -1);
    if (/^[1-9]\d*$/.test(length) === true) {
      return `CHAR(${length})`;
    }
  }
  return "TEXT";
}

type PgParamKinds = {
  text: string;
  number: number;
  boolean: boolean;
};

type PgParam = PgParamKinds[keyof PgParamKinds];

const pgScalarSchema = z.union([z.string(), z.number(), z.boolean()]);
const pgPointObjectSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .strict();

function isCoordinate(hostValue: HostValue): hostValue is Coordinate {
  const parsed = coordinateSchema.safeParse(hostValue);
  if (parsed.success === false) {
    return false;
  }
  const x = parsed.data[0];
  const y = parsed.data[1];
  if (Number.isFinite(x) === false || Number.isFinite(y) === false) {
    return false;
  }
  return true;
}

function coordinateText(coordinate: Coordinate): string {
  const parts = coordinateSchema.safeParse(coordinate);
  if (parts.success === false) {
    throw PgEncodeError.create("coordinate required");
  }
  const x = parts.data[0];
  const y = parts.data[1];
  if (Number.isFinite(x) === false || Number.isFinite(y) === false) {
    throw PgEncodeError.create("coordinate required");
  }
  return `(${x},${y})`;
}

function entityValueToPg(entityValue: EntityValue, group: FilterGroup): PgParam {
  if (group === "coordinate") {
    if (isCoordinate(entityValue) === false) {
      throw PgEncodeError.create("coordinate required");
    }
    return coordinateText(entityValue);
  }
  if (group === "boolean") {
    const boolParsed = z.boolean().safeParse(entityValue);
    if (boolParsed.success === false) {
      throw PgEncodeError.create("boolean required");
    }
    return boolParsed.data;
  }
  if (group === "numeric") {
    const numberParsed = z.number().finite().safeParse(entityValue);
    if (numberParsed.success === false) {
      throw PgEncodeError.create("finite number required");
    }
    return numberParsed.data;
  }
  if (group === "json") {
    const jsonTextParsed = z.string().safeParse(entityValue);
    if (jsonTextParsed.success === false) {
      throw PgEncodeError.create("json text required");
    }
    try {
      JSON.parse(jsonTextParsed.data);
    } catch {
      throw PgEncodeError.create("json parse failed");
    }
    return jsonTextParsed.data;
  }
  const textParsed = z.string().safeParse(entityValue);
  if (textParsed.success === false) {
    throw PgEncodeError.create("string required");
  }
  if (group === "bigint") {
    if (/^-?\d+$/.test(textParsed.data) === false) {
      throw PgEncodeError.create("bigint shape required");
    }
    return textParsed.data;
  }
  if (group === "decimal") {
    if (/^-?\d+(\.\d+)?$/.test(textParsed.data) === false) {
      throw PgEncodeError.create("decimal shape required");
    }
    return textParsed.data;
  }
  if (group === "binary") {
    if (byteaSchema.safeParse(textParsed.data).success === false) {
      throw PgEncodeError.create("bytea shape required");
    }
    return textParsed.data;
  }
  if (group === "geometric") {
    if (geometricValueSchema.safeParse(textParsed.data).success === false) {
      throw PgEncodeError.create("geometric shape required");
    }
    return textParsed.data;
  }
  return textParsed.data;
}

function appendItem<T>(items: readonly T[], nextItem: T): T[] {
  if (Array.isArray(items) === false) {
    throw ValidationError.create("append list required");
  }
  const next = items.toSpliced(items.length, 0, nextItem);
  if (next.length !== items.length + 1) {
    throw ValidationError.create("append failed");
  }
  return next;
}

class UpsertSql {
  readonly sql: string;
  readonly values: readonly PgParam[];

  private constructor(sql: string, values: readonly PgParam[]) {
    if (z.string().min(1).safeParse(sql).success === false) {
      throw DatabaseError.create("upsert sql required");
    }
    if (Array.isArray(values) === false) {
      throw DatabaseError.create("upsert values required");
    }
    this.sql = sql;
    this.values = values;
  }

  static fromEntity(model: ModelDef<ModelFieldsInput>, entity: EntityRecord): UpsertSql {
    let columns: readonly string[] = [];
    let placeholders: readonly string[] = [];
    let updates: readonly string[] = [];
    let values: readonly PgParam[] = [];
    let index = 1;
    for (const [key] of Object.entries(model.fields)) {
      const groups = fieldGroupFor(model, key);
      if (groups.length < 1) {
        throw ModelFieldError.create(`unknown field ${key}`);
      }
      const group = firstFilterGroup(groups);
      const col = columnNameFor(key);
      columns = appendItem(columns, col);
      placeholders = appendItem(placeholders, `$${index}`);
      if (col !== "id") {
        updates = appendItem(updates, `${col} = EXCLUDED.${col}`);
      }
      const raws = entityValueAt(entity, key);
      if (raws.length < 1) {
        throw ModelFieldError.create(`missing field ${key}`);
      }
      for (const raw of raws) {
        values = appendItem(values, entityValueToPg(raw, group));
      }
      index += 1;
    }
    const table = `public.${tableNameFor(model.name)}`;
    return new UpsertSql(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`,
      values,
    );
  }
}

function parsePgValue(raw: PgParam, group: FilterGroup): EntityValue {
  const scalarParsed = z.union([z.number(), z.boolean()]).safeParse(raw);
  if (scalarParsed.success === true) {
    return scalarParsed.data;
  }
  const cellTextParsed = z.string().safeParse(raw);
  if (cellTextParsed.success === false) {
    throw PgEncodeError.create("pg cell text required");
  }
  const cellText = cellTextParsed.data;
  if (group === "coordinate") {
    for (const match of cellText.matchAll(/^\(([-\d.]+),([-\d.]+)\)$/g)) {
      let groups: readonly string[] = [];
      let index = 0;
      for (const part of match) {
        if (index === 1 || index === 2) {
          if (z.string().safeParse(part).success === true) {
            groups = appendItem(groups, part);
          }
        }
        index += 1;
      }
      if (groups.length === 2) {
        const x = Number(groups[0]);
        const y = Number(groups[1]);
        if (Number.isFinite(x) === true && Number.isFinite(y) === true) {
          const point: Coordinate = [x, y];
          return point;
        }
      }
    }
  }
  if (group === "numeric") {
    const parsed = Number(cellText);
    if (Number.isFinite(parsed) === true) {
      return parsed;
    }
  }
  if (group === "boolean") {
    if (cellText === "true" || cellText === "t") {
      return true;
    }
    if (cellText === "false" || cellText === "f") {
      return false;
    }
  }
  return cellText;
}

function fieldGroupFor(model: ModelDef<ModelFieldsInput>, key: string): FilterGroup[] {
  if (z.looseObject({}).safeParse(model).success === false) {
    throw ModelFieldError.create("model required for field group");
  }
  if (z.string().min(1).safeParse(key).success === false) {
    throw ModelFieldError.create("field key required");
  }
  for (const [fieldKey, field] of Object.entries(model.fields)) {
    if (fieldKey === key) {
      return [filterGroupOf(field)];
    }
  }
  return [];
}

type DbErrorBox = { message: string };

function dbErrorMessage(err: CaughtFailure): string {
  if (err instanceof Error) {
    if (err.message.length > 0) {
      return err.message;
    }
    throw DatabaseError.create("database unavailable");
  }
  const messageParsed = z.string().safeParse(err);
  if (messageParsed.success === true) {
    if (messageParsed.data.length > 0) {
      return messageParsed.data;
    }
    throw DatabaseError.create("database unavailable");
  }
  const scalarMessageParsed = z.union([z.number(), z.boolean()]).safeParse(err);
  if (scalarMessageParsed.success === true) {
    return `${scalarMessageParsed.data}`;
  }
  throw DatabaseError.create("database unavailable");
}

function dbErrorMessageForLog(err: CaughtFailure, fallback: string): string {
  const fallbackParsed = z.string().min(1).safeParse(fallback);
  const safeFallback =
    fallbackParsed.success === true ? fallbackParsed.data : "database unavailable";
  try {
    return dbErrorMessage(err);
  } catch {
    return safeFallback;
  }
}

function textOrFallback(textHits: readonly string[], fallback: string): string {
  for (const hit of textHits) {
    if (hit.length > 0) {
      return hit;
    }
  }
  if (fallback.length < 1) {
    throw ValidationError.create("fallback text required");
  }
  return fallback;
}

function dbErrorBoxText(errorBox: DbErrorBox): string {
  if (z.object({ message: z.string() }).safeParse(errorBox).success === false) {
    throw DatabaseError.create("database unavailable");
  }
  if (errorBox.message.length > 0) {
    return errorBox.message;
  }
  return "database unavailable";
}

function captureDbError(err: CaughtFailure, errorBox: DbErrorBox): void {
  if (z.object({ message: z.string() }).safeParse(errorBox).success === false) {
    throw DatabaseError.create("database unavailable");
  }
  const message = dbErrorMessageForLog(err, "database unavailable");
  if (z.string().min(1).safeParse(message).success === false) {
    errorBox.message = "database unavailable";
    return;
  }
  errorBox.message = message;
}

function pgCellRawPresent(raw: HostValue): boolean {
  if (pgScalarSchema.safeParse(raw).success === true) {
    return true;
  }
  if (raw instanceof Date) {
    if (Number.isFinite(raw.getTime()) === false) {
      return false;
    }
    return true;
  }
  if (Buffer.isBuffer(raw) === true) {
    return true;
  }
  if (Array.isArray(raw) === true) {
    return true;
  }
  return isPlainRecord(raw);
}

function pgCellValue(raw: HostValue): PgParam {
  const scalar = pgScalarSchema.safeParse(raw);
  if (scalar.success === true) {
    return scalar.data;
  }
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime()) === true) {
      throw PgEncodeError.create("invalid date cell");
    }
    return raw.toISOString();
  }
  if (Buffer.isBuffer(raw) === true) {
    return `\\x${raw.toString("hex")}`;
  }
  const point = pgPointObjectSchema.safeParse(raw);
  if (point.success === true) {
    return `(${point.data.x},${point.data.y})`;
  }
  if (isPlainRecord(raw) === true) {
    return JSON.stringify(raw);
  }
  if (Array.isArray(raw) === true) {
    if (isCoordinate(raw) === true) {
      return coordinateText(raw);
    }
    return JSON.stringify(raw);
  }
  throw PgEncodeError.create("unsupported pg cell");
}

function pgRowCells(row: pg.QueryResultRow): Record<string, PgParam> {
  const cells: Record<string, PgParam> = {};
  for (const [key, raw] of Object.entries(row)) {
    if (pgCellRawPresent(raw) === false) {
      continue;
    }
    cells[key] = pgCellValue(raw);
  }
  return cells;
}

function firstQueryRow(rows: readonly pg.QueryResultRow[]): pg.QueryResultRow[] {
  if (Array.isArray(rows) === false) {
    throw DatabaseError.create("query rows required");
  }
  let found: readonly pg.QueryResultRow[] = [];
  for (const row of rows) {
    found = appendItem(found, row);
    break;
  }
  return found.slice();
}

function isEntityValue(hostValue: HostValue): hostValue is EntityValue {
  if (z.union([z.string(), z.boolean()]).safeParse(hostValue).success === true) {
    return true;
  }
  const numberParsed = z.number().safeParse(hostValue);
  if (numberParsed.success === true) {
    return Number.isFinite(numberParsed.data);
  }
  return isCoordinate(hostValue);
}

function entityValueAt(entity: EntityRecord, key: string): EntityValue[] {
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

function entityValuesEqual(left: EntityValue, right: EntityValue): boolean {
  if (isCoordinate(left) && isCoordinate(right)) {
    let leftX = 0;
    let leftY = 0;
    let rightX = 0;
    let rightY = 0;
    let index = 0;
    for (const part of left) {
      if (index === 0) {
        leftX = part;
      } else if (index === 1) {
        leftY = part;
      }
      index += 1;
    }
    index = 0;
    for (const part of right) {
      if (index === 0) {
        rightX = part;
      } else if (index === 1) {
        rightY = part;
      }
      index += 1;
    }
    return leftX === rightX && leftY === rightY;
  }
  return left === right;
}

function compareOrderedNumbers(left: number, right: number): readonly number[] {
  if (Number.isFinite(left) === false || Number.isFinite(right) === false) {
    return [];
  }
  if (left < right) {
    return [-1];
  }
  if (left > right) {
    return [1];
  }
  return [0];
}

const compareBoundSchema = z.union([z.number().finite(), z.string()]);

function compareBoundOk(group: FilterGroup, bound: OrderedBound): boolean {
  if (group === "numeric") {
    return z.number().finite().safeParse(bound).success === true;
  }
  if (group === "bigint") {
    return bigintSchema.safeParse(bound).success === true;
  }
  if (group === "decimal") {
    return decimalSchema.safeParse(bound).success === true;
  }
  if (group === "temporal") {
    return temporalFilterValue.safeParse(bound).success === true;
  }
  return compareBoundSchema.safeParse(bound).success === true;
}

function compareDecimalStrings(left: string, right: string): readonly number[] {
  let leftBody = left;
  let rightBody = right;
  let leftNegative = false;
  let rightNegative = false;
  if (leftBody.startsWith("-") === true) {
    leftNegative = true;
    leftBody = leftBody.slice(1);
  }
  if (rightBody.startsWith("-") === true) {
    rightNegative = true;
    rightBody = rightBody.slice(1);
  }
  const leftMarked = leftBody.includes(".") === true ? leftBody : `${leftBody}.`;
  const rightMarked = rightBody.includes(".") === true ? rightBody : `${rightBody}.`;
  const leftDot = leftMarked.indexOf(".");
  const rightDot = rightMarked.indexOf(".");
  const leftInt = leftMarked.slice(0, leftDot);
  const leftFrac = leftMarked.slice(leftDot + 1);
  const rightInt = rightMarked.slice(0, rightDot);
  const rightFrac = rightMarked.slice(rightDot + 1);
  let scale = leftFrac.length;
  if (rightFrac.length > scale) {
    scale = rightFrac.length;
  }
  const leftFracPadded = leftFrac.padEnd(scale, "0");
  const rightFracPadded = rightFrac.padEnd(scale, "0");
  let leftScaled = BigInt(`${leftInt}${leftFracPadded}`);
  let rightScaled = BigInt(`${rightInt}${rightFracPadded}`);
  if (leftNegative === true) {
    leftScaled = -leftScaled;
  }
  if (rightNegative === true) {
    rightScaled = -rightScaled;
  }
  if (leftScaled < rightScaled) {
    return [-1];
  }
  if (leftScaled > rightScaled) {
    return [1];
  }
  return [0];
}

function orderedCompare(
  left: EntityValue,
  right: OrderedBound,
  group: FilterGroup,
): readonly number[] {
  if (group === "bigint") {
    if (z.string().safeParse(left).success === false || z.string().safeParse(right).success === false) {
      return [];
    }
    const leftText = String(left);
    const rightText = String(right);
    if (/^-?\d+$/.test(leftText) === false || /^-?\d+$/.test(rightText) === false) {
      return [];
    }
    const leftBig = BigInt(leftText);
    const rightBig = BigInt(rightText);
    if (leftBig < rightBig) {
      return [-1];
    }
    if (leftBig > rightBig) {
      return [1];
    }
    return [0];
  }
  if (group === "decimal") {
    if (z.string().safeParse(left).success === false || z.string().safeParse(right).success === false) {
      return [];
    }
    const leftText = String(left);
    const rightText = String(right);
    if (/^-?\d+(\.\d+)?$/.test(leftText) === false || /^-?\d+(\.\d+)?$/.test(rightText) === false) {
      return [];
    }
    return compareDecimalStrings(leftText, rightText);
  }
  const leftNumber = z.number().safeParse(left);
  const rightNumber = z.number().safeParse(right);
  if (leftNumber.success === true && rightNumber.success === true) {
    return compareOrderedNumbers(leftNumber.data, rightNumber.data);
  }
  const leftString = z.string().safeParse(left);
  const rightString = z.string().safeParse(right);
  if (leftString.success === true && rightString.success === true) {
    if (leftString.data < rightString.data) {
      return [-1];
    }
    if (leftString.data > rightString.data) {
      return [1];
    }
    return [0];
  }
  return [];
}

function likePatternMatch(sourceText: string, pattern: string, caseSensitive: boolean): boolean {
  const source = caseSensitive === true ? sourceText : sourceText.toLowerCase();
  const expected = caseSensitive === true ? pattern : pattern.toLowerCase();
  let sourceIndex = 0;
  let patternIndex = 0;
  let starSource = -1;
  let starPattern = -1;
  while (sourceIndex < source.length) {
    const patternChar = patternIndex < expected.length ? expected[patternIndex] : false;
    if (patternChar === "\\") {
      if (patternIndex + 1 >= expected.length) {
        return false;
      }
      const literal = expected[patternIndex + 1];
      if (literal === source[sourceIndex]) {
        sourceIndex += 1;
        patternIndex += 2;
        continue;
      }
      if (starPattern !== -1) {
        starSource += 1;
        sourceIndex = starSource;
        patternIndex = starPattern + 1;
        continue;
      }
      return false;
    }
    if (patternChar !== false && patternChar !== "%" && patternChar !== "_") {
      if (patternChar === source[sourceIndex]) {
        sourceIndex += 1;
        patternIndex += 1;
        continue;
      }
      if (starPattern !== -1) {
        starSource += 1;
        sourceIndex = starSource;
        patternIndex = starPattern + 1;
        continue;
      }
      return false;
    }
    if (patternChar === "_") {
      sourceIndex += 1;
      patternIndex += 1;
      continue;
    }
    if (patternChar === "%") {
      starPattern = patternIndex;
      starSource = sourceIndex;
      patternIndex += 1;
      continue;
    }
    if (starPattern !== -1) {
      starSource += 1;
      sourceIndex = starSource;
      patternIndex = starPattern + 1;
      continue;
    }
    return false;
  }
  while (patternIndex < expected.length && expected[patternIndex] === "%") {
    patternIndex += 1;
  }
  return patternIndex === expected.length;
}

function entityMatchesFilter(
  model: ModelDef<ModelFieldsInput>,
  entity: EntityRecord,
  filter: FilterState,
): boolean {
  for (const [key, clause] of Object.entries(filter)) {
    const groups = fieldGroupFor(model, key);
    if (groups.length < 1) {
      return false;
    }
    const group = firstFilterGroup(groups);
    if (filterClauseUnsupported(group, clause) === true) {
      return false;
    }
    const atValues = entityValueAt(entity, key);
    if ("eq" in clause) {
      const eqParsed = jsonWireSchema.safeParse(clause.eq);
      if (eqParsed.success === false || isEntityValue(eqParsed.data) === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        if (entityValuesEqual(atValue, eqParsed.data) === false) {
          return false;
        }
      }
    }
    if ("ne" in clause) {
      const neParsed = jsonWireSchema.safeParse(clause.ne);
      if (neParsed.success === false || isEntityValue(neParsed.data) === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        if (entityValuesEqual(atValue, neParsed.data) === true) {
          return false;
        }
      }
    }
    if ("gt" in clause) {
      const bound = filterBoundSchema.safeParse(clause.gt);
      if (bound.success === false || compareBoundOk(group, bound.data) === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        const cmpHits = orderedCompare(atValue, bound.data, group);
        if (cmpHits.length < 1 || cmpHits[0] !== 1) {
          return false;
        }
      }
    }
    if ("gte" in clause) {
      const bound = filterBoundSchema.safeParse(clause.gte);
      if (bound.success === false || compareBoundOk(group, bound.data) === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        const cmpHits = orderedCompare(atValue, bound.data, group);
        if (cmpHits.length < 1) {
          return false;
        }
        let gteOrder = 0;
        for (const cmp of cmpHits) {
          gteOrder = cmp;
          break;
        }
        if (gteOrder < 0) {
          return false;
        }
      }
    }
    if ("lt" in clause) {
      const bound = filterBoundSchema.safeParse(clause.lt);
      if (bound.success === false || compareBoundOk(group, bound.data) === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        const cmpHits = orderedCompare(atValue, bound.data, group);
        if (cmpHits.length < 1 || cmpHits[0] !== -1) {
          return false;
        }
      }
    }
    if ("lte" in clause) {
      const bound = filterBoundSchema.safeParse(clause.lte);
      if (bound.success === false || compareBoundOk(group, bound.data) === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        const cmpHits = orderedCompare(atValue, bound.data, group);
        if (cmpHits.length < 1) {
          return false;
        }
        let lteOrder = 0;
        for (const cmp of cmpHits) {
          lteOrder = cmp;
          break;
        }
        if (lteOrder > 0) {
          return false;
        }
      }
    }
    if ("like" in clause) {
      const text = filterTextSchema.safeParse(clause.like);
      if (text.success === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        const stringAt = z.string().safeParse(atValue);
        if (stringAt.success === false) {
          return false;
        }
        if (likePatternMatch(stringAt.data, text.data, true) === false) {
          return false;
        }
      }
    }
    if ("ilike" in clause) {
      const text = filterTextSchema.safeParse(clause.ilike);
      if (text.success === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        const stringAt = z.string().safeParse(atValue);
        if (stringAt.success === false) {
          return false;
        }
        if (likePatternMatch(stringAt.data, text.data, false) === false) {
          return false;
        }
      }
    }
    if ("startsWith" in clause) {
      const text = filterTextSchema.safeParse(clause.startsWith);
      if (text.success === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        const stringAt = z.string().safeParse(atValue);
        if (stringAt.success === false) {
          return false;
        }
        if (stringAt.data.startsWith(text.data) === false) {
          return false;
        }
      }
    }
    if ("endsWith" in clause) {
      const text = filterTextSchema.safeParse(clause.endsWith);
      if (text.success === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        const stringAt = z.string().safeParse(atValue);
        if (stringAt.success === false) {
          return false;
        }
        if (stringAt.data.endsWith(text.data) === false) {
          return false;
        }
      }
    }
    if ("contains" in clause) {
      const text = filterTextSchema.safeParse(clause.contains);
      if (text.success === false) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      for (const atValue of atValues) {
        const stringAt = z.string().safeParse(atValue);
        if (stringAt.success === false) {
          return false;
        }
        if (stringAt.data.toLowerCase().includes(text.data.toLowerCase()) === false) {
          return false;
        }
      }
    }
    if (Array.isArray(clause.in)) {
      if (clause.in.length < 1) {
        return false;
      }
      if (atValues.length < 1) {
        return false;
      }
      let matches: readonly EntityValue[] = [];
      for (const atValue of atValues) {
        for (const inOperand of clause.in) {
          if (entityValuesEqual(atValue, inOperand) === true) {
            matches = appendItem(matches, inOperand);
          }
        }
      }
      if (matches.length < 1) {
        return false;
      }
    }
    if (Array.isArray(clause.near)) {
      try {
        const point = nearPoint(clause.near);
        if (atValues.length < 1) {
          return false;
        }
        for (const atValue of atValues) {
          if (isCoordinate(atValue) === false) {
            return false;
          }
          let xs: readonly number[] = [];
          let ys: readonly number[] = [];
          let index = 0;
          for (const part of atValue) {
            if (index === 0) {
              xs = appendItem(xs, part);
            } else if (index === 1) {
              ys = appendItem(ys, part);
            }
            index += 1;
          }
          if (xs.length < 1 || ys.length < 1) {
            return false;
          }
          for (const x of xs) {
            for (const y of ys) {
              const dx = x - point.x;
              const dy = y - point.y;
              if (dx * dx + dy * dy > point.meters * point.meters) {
                return false;
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof ModelFieldError) {
          return false;
        }
        throw err;
      }
    }
  }
  return true;
}

function escapeLikePattern(patternText: string): string {
  if (z.string().safeParse(patternText).success === false) {
    throw ModelFieldError.create("like pattern must be a string");
  }
  const escaped = patternText.replace(/[\\%_]/g, (match) => `\\${match}`);
  if (escaped.length < patternText.length) {
    return escaped;
  }
  return escaped;
}

const nearTupleSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite().nonnegative(),
]);

class NearPoint {
  readonly x: number;
  readonly y: number;
  readonly meters: number;

  private constructor(x: number, y: number, meters: number) {
    if (Number.isFinite(x) === false) {
      throw ModelFieldError.create("near requires finite x, y, meters>=0");
    }
    if (Number.isFinite(y) === false) {
      throw ModelFieldError.create("near requires finite x, y, meters>=0");
    }
    if (Number.isFinite(meters) === false || meters < 0) {
      throw ModelFieldError.create("near requires finite x, y, meters>=0");
    }
    this.x = x;
    this.y = y;
    this.meters = meters;
  }

  static create(x: number, y: number, meters: number): NearPoint {
    const parsed = nearTupleSchema.safeParse([x, y, meters]);
    if (parsed.success === false) {
      throw ModelFieldError.create("near requires finite x, y, meters>=0");
    }
    const pointX = parsed.data[0];
    const pointY = parsed.data[1];
    const pointMeters = parsed.data[2];
    return new NearPoint(pointX, pointY, pointMeters);
  }
}

function nearPoint(near: readonly [number, number, number]): NearPoint {
  const parsed = nearTupleSchema.safeParse(near);
  if (parsed.success === false) {
    throw ModelFieldError.create("near requires finite x, y, meters>=0");
  }
  const pointX = parsed.data[0];
  const pointY = parsed.data[1];
  const pointMeters = parsed.data[2];
  return NearPoint.create(pointX, pointY, pointMeters);
}

const filterBoundSchema = z.union([z.number().finite(), z.string()]);
const filterTextSchema = z.string();

type SqlCompareOpKinds = {
  eq: "=";
  ne: "<>";
};

type SqlCompareOp = SqlCompareOpKinds[keyof SqlCompareOpKinds];

type WhereBuild = {
  parts: readonly string[];
  params: readonly PgParam[];
  index: number;
};

class WhereSql {
  readonly sql: string;
  readonly params: readonly PgParam[];

  private constructor(sql: string, params: readonly PgParam[]) {
    if (z.string().min(1).safeParse(sql).success === false) {
      throw DatabaseError.create("where sql required");
    }
    if (Array.isArray(params) === false) {
      throw DatabaseError.create("where params required");
    }
    this.sql = sql;
    this.params = params;
  }

  private static push(build: WhereBuild, sql: string, sqlParam: PgParam): WhereBuild {
    if (z.string().min(1).safeParse(sql).success === false) {
      throw DatabaseError.create("where fragment required");
    }
    if (Number.isFinite(build.index) === false || build.index < 1) {
      throw DatabaseError.create("where param index required");
    }
    return {
      parts: appendItem(build.parts, sql),
      params: appendItem(build.params, sqlParam),
      index: build.index + 1,
    };
  }

  private static pushCompare(
    build: WhereBuild,
    col: string,
    op: SqlCompareOp,
    compareValue: EntityValue,
    group: FilterGroup,
  ): WhereBuild {
    try {
      return WhereSql.push(
        build,
        `${col} ${op} $${build.index}`,
        entityValueToPg(compareValue, group),
      );
    } catch (err) {
      if (err instanceof PgEncodeError) {
        throw ModelFieldError.create(err.message);
      }
      throw err;
    }
  }

  static fromFilter(model: ModelDef<ModelFieldsInput>, filter: FilterState): WhereSql {
    let build: WhereBuild = {
      parts: ["is_deleted = false"],
      params: [],
      index: 1,
    };
    for (const [key, clause] of Object.entries(filter)) {
      const groups = fieldGroupFor(model, key);
      if (groups.length < 1) {
        throw ModelFieldError.create(`unknown filter field ${key}`);
      }
      const group = firstFilterGroup(groups);
      if (filterClauseUnsupported(group, clause) === true) {
        throw ModelFieldError.create(`unsupported filter on ${key}`);
      }
      const col = columnNameFor(key);
      if ("eq" in clause) {
        const eqParsed = jsonWireSchema.safeParse(clause.eq);
        if (eqParsed.success === false || isEntityValue(eqParsed.data) === false) {
          throw ModelFieldError.create(`invalid eq on ${key}`);
        }
        build = WhereSql.pushCompare(build, col, "=", eqParsed.data, group);
      }
      if ("ne" in clause) {
        const neParsed = jsonWireSchema.safeParse(clause.ne);
        if (neParsed.success === false || isEntityValue(neParsed.data) === false) {
          throw ModelFieldError.create(`invalid ne on ${key}`);
        }
        build = WhereSql.pushCompare(build, col, "<>", neParsed.data, group);
      }
      if ("gt" in clause) {
        const bound = filterBoundSchema.safeParse(clause.gt);
        if (bound.success === false || compareBoundOk(group, bound.data) === false) {
          throw ModelFieldError.create(`invalid gt on ${key}`);
        }
        build = WhereSql.push(build, `${col} > $${build.index}`, bound.data);
      }
      if ("gte" in clause) {
        const bound = filterBoundSchema.safeParse(clause.gte);
        if (bound.success === false || compareBoundOk(group, bound.data) === false) {
          throw ModelFieldError.create(`invalid gte on ${key}`);
        }
        build = WhereSql.push(build, `${col} >= $${build.index}`, bound.data);
      }
      if ("lt" in clause) {
        const bound = filterBoundSchema.safeParse(clause.lt);
        if (bound.success === false || compareBoundOk(group, bound.data) === false) {
          throw ModelFieldError.create(`invalid lt on ${key}`);
        }
        build = WhereSql.push(build, `${col} < $${build.index}`, bound.data);
      }
      if ("lte" in clause) {
        const bound = filterBoundSchema.safeParse(clause.lte);
        if (bound.success === false || compareBoundOk(group, bound.data) === false) {
          throw ModelFieldError.create(`invalid lte on ${key}`);
        }
        build = WhereSql.push(build, `${col} <= $${build.index}`, bound.data);
      }
      if ("like" in clause) {
        const text = filterTextSchema.safeParse(clause.like);
        if (text.success === false) {
          throw ModelFieldError.create(`invalid like on ${key}`);
        }
        build = WhereSql.push(
          build,
          `${col} LIKE $${build.index} ESCAPE E'\\\\'`,
          text.data,
        );
      }
      if ("ilike" in clause) {
        const text = filterTextSchema.safeParse(clause.ilike);
        if (text.success === false) {
          throw ModelFieldError.create(`invalid ilike on ${key}`);
        }
        build = WhereSql.push(
          build,
          `${col} ILIKE $${build.index} ESCAPE E'\\\\'`,
          text.data,
        );
      }
      if ("startsWith" in clause) {
        const text = filterTextSchema.safeParse(clause.startsWith);
        if (text.success === false) {
          throw ModelFieldError.create(`invalid startsWith on ${key}`);
        }
        build = WhereSql.push(
          build,
          `${col} LIKE $${build.index} ESCAPE E'\\\\'`,
          `${escapeLikePattern(text.data)}%`,
        );
      }
      if ("endsWith" in clause) {
        const text = filterTextSchema.safeParse(clause.endsWith);
        if (text.success === false) {
          throw ModelFieldError.create(`invalid endsWith on ${key}`);
        }
        build = WhereSql.push(
          build,
          `${col} LIKE $${build.index} ESCAPE E'\\\\'`,
          `%${escapeLikePattern(text.data)}`,
        );
      }
      if ("contains" in clause) {
        const text = filterTextSchema.safeParse(clause.contains);
        if (text.success === false) {
          throw ModelFieldError.create(`invalid contains on ${key}`);
        }
        build = WhereSql.push(
          build,
          `${col}::text ILIKE $${build.index} ESCAPE E'\\\\'`,
          `%${escapeLikePattern(text.data)}%`,
        );
      }
      if ("in" in clause) {
        if (Array.isArray(clause.in) === false || clause.in.length < 1) {
          throw ModelFieldError.create(`invalid in on ${key}`);
        }
        let slots: readonly string[] = [];
        try {
          for (const inOperand of clause.in) {
            slots = appendItem(slots, `$${build.index}`);
            build = {
              parts: build.parts,
              params: appendItem(build.params, entityValueToPg(inOperand, group)),
              index: build.index + 1,
            };
          }
        } catch (err) {
          if (err instanceof PgEncodeError) {
            throw ModelFieldError.create(err.message);
          }
          throw err;
        }
        build = {
          parts: appendItem(build.parts, `${col} IN (${slots.join(", ")})`),
          params: build.params,
          index: build.index,
        };
      }
      if ("near" in clause) {
        if (Array.isArray(clause.near) === false) {
          throw ModelFieldError.create(`invalid near on ${key}`);
        }
        const point = nearPoint(clause.near);
        const nearParams = appendItem(
          appendItem(appendItem(build.params, point.x), point.y),
          point.meters,
        );
        build = {
          parts: appendItem(
            build.parts,
            `${col} <@ circle(point($${build.index}, $${build.index + 1}), $${build.index + 2})`,
          ),
          params: nearParams,
          index: build.index + 3,
        };
      }
    }
    return new WhereSql(build.parts.join(" AND "), build.params);
  }
}

function rowToEntity(
  model: ModelDef<ModelFieldsInput>,
  row: Record<string, PgParam>,
): EntityRecord {
  const entity: EntityRecord = {};
  for (const [col, raw] of Object.entries(row)) {
    const key = toCamelCase(col);
    const groups = fieldGroupFor(model, key);
    if (groups.length < 1) {
      continue;
    }
    entity[key] = parsePgValue(raw, firstFilterGroup(groups));
  }
  const ids = entityValueAt(entity, "id");
  if (ids.length < 1) {
    throw DatabaseError.create("entity row invalid");
  }
  for (const id of ids) {
    if (z.string().safeParse(id).success === false) {
      throw DatabaseError.create("entity row invalid");
    }
  }
  return entity;
}

type StoreDbErrorHandler = (message: string) => void;

class PostgresStore {
  private readonly db: PgQueryable;
  private readonly onDbError: readonly StoreDbErrorHandler[];

  private constructor(db: PgQueryable, onDbError: readonly StoreDbErrorHandler[]) {
    if (z.function().safeParse(db.query).success === false) {
      throw DatabaseError.create("database client required");
    }
    if (Array.isArray(onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    this.db = db;
    this.onDbError = onDbError;
  }

  static create(
    db: PgQueryable,
    onDbError: readonly StoreDbErrorHandler[] = [],
  ): PostgresStore {
    if (z.function().safeParse(db.query).success === false) {
      throw DatabaseError.create("database client required");
    }
    if (Array.isArray(onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    return new PostgresStore(db, onDbError);
  }

  withClient(client: PgQueryable): PostgresStore {
    if (z.function().safeParse(client.query).success === false) {
      throw DatabaseError.create("database client required");
    }
    if (Array.isArray(this.onDbError) === false) {
      throw DatabaseError.create("database error handlers required");
    }
    return PostgresStore.create(client, this.onDbError);
  }

  private failQuery(err: CaughtFailure): false {
    const message = dbErrorMessageForLog(err, "database unavailable");
    if (z.string().min(1).safeParse(message).success === false) {
      return false;
    }
    for (const reportDbError of this.onDbError) {
      reportDbError(message);
      break;
    }
    return false;
  }

  async ensureAllTables(
    models: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    errorBox: DbErrorBox,
  ): Promise<boolean> {
    for (const model of models) {
      const ok = await this.ensureModelTable(model, errorBox);
      if (ok === false) {
        return false;
      }
    }
    return this.ensureOutboxTable(errorBox);
  }

  private async ensureModelTable(
    model: ModelDef<ModelFieldsInput>,
    errorBox: DbErrorBox,
  ): Promise<boolean> {
    const table = tableNameFor(model.name);
    const qualified = `public.${table}`;
    let columns: readonly string[] = [];
    for (const [key, field] of Object.entries(model.fields)) {
      const col = columnNameFor(key);
      const type = pgColumnType(field);
      if (key === "isDeleted") {
        columns = appendItem(columns, `${col} ${type} NOT NULL DEFAULT false`);
      } else if (key === "createdAt" || key === "updatedAt") {
        columns = appendItem(columns, `${col} ${type} NOT NULL DEFAULT NOW()`);
      } else if (isSystemFieldKey(key)) {
        columns = appendItem(columns, `${col} ${type} NOT NULL`);
      } else {
        columns = appendItem(columns, `${col} ${type}`);
      }
    }
    const sql = `CREATE TABLE IF NOT EXISTS ${qualified} (${columns.join(", ")}, PRIMARY KEY (id))`;
    try {
      await this.db.query(sql);
      for (const [alterKey, alterField] of Object.entries(model.fields)) {
        const col = columnNameFor(alterKey);
        const type = pgColumnType(alterField);
        let alterSql = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS ${col} ${type}`;
        if (alterKey === "isDeleted") {
          alterSql = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS ${col} ${type} NOT NULL DEFAULT false`;
        } else if (alterKey === "createdAt" || alterKey === "updatedAt") {
          alterSql = `ALTER TABLE ${qualified} ADD COLUMN IF NOT EXISTS ${col} ${type} NOT NULL DEFAULT NOW()`;
        }
        await this.db.query(alterSql);
        if (isRelationField(alterField) === false && alterField.meta.unique) {
          await this.db.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_${col}_uidx ON ${qualified} (${col})`,
          );
        }
        if (
          isRelationField(alterField) === false &&
          alterField.meta.index &&
          alterField.meta.unique === false
        ) {
          await this.db.query(
            `CREATE INDEX IF NOT EXISTS ${table}_${col}_idx ON ${qualified} (${col})`,
          );
        }
      }
      return true;
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }

  private async ensureOutboxTable(errorBox: DbErrorBox): Promise<boolean> {
    const sql = `CREATE TABLE IF NOT EXISTS ${outboxTableName} (
    external_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    entity_id TEXT NOT NULL,
    model TEXT NOT NULL,
    run_id TEXT NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 1
  )`;
    try {
      await this.db.query(sql);
      await this.db.query(
        `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1`,
      );
      return true;
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }

  async upsertEntity(model: ModelDef<ModelFieldsInput>, entity: EntityRecord): Promise<boolean> {
    try {
      const plan = UpsertSql.fromEntity(model, entity);
      await this.db.query(plan.sql, plan.values.slice());
      return true;
    } catch (err) {
      if (err instanceof PgEncodeError || err instanceof ModelFieldError) {
        return false;
      }
      return this.failQuery(err);
    }
  }

  async loadEntity(model: ModelDef<ModelFieldsInput>, entityId: string): Promise<EntityRecord> {
    const table = `public.${tableNameFor(model.name)}`;
    const sql = `SELECT * FROM ${table} WHERE id = $1 AND is_deleted = false`;
    try {
      const queryResult = await this.db.query(sql, [entityId]);
      const rows = firstQueryRow(queryResult.rows);
      if (rows.length < 1) {
        throw NotFoundError.create("entity not found");
      }
      for (const row of rows) {
        try {
          const cells = pgRowCells(row);
          return rowToEntity(model, cells);
        } catch (err) {
          if (err instanceof PgEncodeError) {
            throw DatabaseError.create("entity row invalid");
          }
          throw err;
        }
      }
      throw NotFoundError.create("entity not found");
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof DatabaseError) {
        throw err;
      }
      const message = dbErrorMessageForLog(err, "database unavailable");
      for (const reportDbError of this.onDbError) {
        reportDbError(message);
        break;
      }
      throw DatabaseError.create(message);
    }
  }

  async queryEntities(
    model: ModelDef<ModelFieldsInput>,
    filter: FilterState,
  ): Promise<EntityRecord[]> {
    const where = WhereSql.fromFilter(model, filter);
    const table = `public.${tableNameFor(model.name)}`;
    const sql = `SELECT * FROM ${table} WHERE ${where.sql}`;
    try {
      const queryResult = await this.db.query(sql, where.params.slice());
      let entities: readonly EntityRecord[] = [];
      for (const row of queryResult.rows) {
        try {
          const cells = pgRowCells(row);
          entities = appendItem(entities, rowToEntity(model, cells));
        } catch (err) {
          if (err instanceof PgEncodeError) {
            throw DatabaseError.create("entity row invalid");
          }
          throw err;
        }
      }
      return entities.slice();
    } catch (err) {
      if (err instanceof ModelFieldError || err instanceof DatabaseError) {
        throw err;
      }
      this.failQuery(err);
      throw DatabaseError.create(dbErrorMessageForLog(err, "database unavailable"));
    }
  }

  async saveOutboxEntry(outboxRow: OutboxEntry): Promise<boolean> {
    const conflict =
      "ON CONFLICT (external_id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status, input = EXCLUDED.input, output = EXCLUDED.output, entity_id = EXCLUDED.entity_id, model = EXCLUDED.model, run_id = EXCLUDED.run_id, attempt = EXCLUDED.attempt";
    try {
      if (outboxRow.status === "completed") {
        const sql = `INSERT INTO ${outboxTableName} (external_id, name, status, input, output, entity_id, model, run_id, attempt)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
    ${conflict}`;
        await this.db.query(sql, [
          outboxRow.externalId,
          outboxRow.name,
          outboxRow.status,
          JSON.stringify(outboxRow.input),
          JSON.stringify(outboxRow.output),
          outboxRow.entityId,
          outboxRow.model,
          outboxRow.runId,
          outboxRow.attempt,
        ]);
        return true;
      }
      const sql = `INSERT INTO ${outboxTableName} (external_id, name, status, input, output, entity_id, model, run_id, attempt)
    VALUES ($1, $2, $3, $4::jsonb, NULL::jsonb, $5, $6, $7, $8)
    ${conflict}`;
      await this.db.query(sql, [
        outboxRow.externalId,
        outboxRow.name,
        outboxRow.status,
        JSON.stringify(outboxRow.input),
        outboxRow.entityId,
        outboxRow.model,
        outboxRow.runId,
        outboxRow.attempt,
      ]);
      return true;
    } catch (err) {
      return this.failQuery(err);
    }
  }

  async loadOutbox(outbox: Map<string, OutboxEntry>, errorBox: DbErrorBox): Promise<boolean> {
    const sql = `SELECT external_id, name, status, input, output, entity_id, model, run_id, attempt FROM ${outboxTableName}`;
    try {
      const queryResult = await this.db.query(sql);
      for (const row of queryResult.rows) {
        const entries = outboxEntryFromRow(row);
        if (entries.length < 1) {
          return false;
        }
        for (const outboxRow of entries) {
          outbox.set(outboxRow.externalId, outboxRow);
        }
      }
      return true;
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }
}

function outboxAttempt(raw: HostValue): readonly number[] {
  const asNumber = z.number().int().min(1).safeParse(raw);
  if (asNumber.success === true) {
    return [asNumber.data];
  }
  try {
    const asString = pgCellToString(raw);
    const parsed = z.coerce.number().int().min(1).safeParse(asString);
    if (parsed.success === true) {
      return [parsed.data];
    }
  } catch {
    return [];
  }
  return [];
}

function outboxEntryFromRow(row: pg.QueryResultRow): readonly OutboxEntry[] {
  try {
    const status = pgCellToString(row.status);
    const externalId = pgCellToString(row.external_id);
    const name = pgCellToString(row.name);
    const entityId = pgCellToString(row.entity_id);
    const model = pgCellToString(row.model);
    const runId = pgCellToString(row.run_id);
    const inputHits = entityRecordFromJson(row.input);
    const attemptHits = outboxAttempt(row.attempt);
    if (isOutboxStatus(status) === false || inputHits.length < 1 || attemptHits.length < 1) {
      return [];
    }
    const input = requireEntityRecord(inputHits, "outbox input required");
    let attempt = 0;
    for (const hit of attemptHits) {
      attempt = hit;
    }
    if (status === "pending" || status === "failed") {
      return [{
        externalId,
        name,
        entityId,
        model,
        runId,
        attempt,
        input,
        status,
      }];
    }
    const outputHits = entityRecordFromJson(row.output);
    if (outputHits.length < 1) {
      return [];
    }
    const output = requireEntityRecord(outputHits, "outbox output required");
    return [{
      externalId,
      name,
      entityId,
      model,
      runId,
      attempt,
      input,
      status: "completed",
      output,
    }];
  } catch {
    return [];
  }
}

async function getEntity(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
): Promise<EntityRecord> {
  const key = entityStoreKey(model.name, entityId);
  for (const cached of mapLookup(rt.entities, key)) {
    if (cached.id !== entityId) {
      rt.entities.delete(key);
    } else {
      const deletedValues = entityValueAt(cached, "isDeleted");
      for (const deleted of deletedValues) {
        if (deleted === true) {
          rt.entities.delete(key);
          throw NotFoundError.create("entity not found");
        }
      }
      return cached;
    }
  }
  try {
    const fromDb = await rt.store.loadEntity(model, entityId);
    rt.entities.set(key, fromDb);
    return fromDb;
  } catch (err) {
    if (err instanceof DatabaseError) {
      logDatabaseFailure(rt);
    }
    throw err;
  }
}

async function persistEntity(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  entity: EntityRecord,
): Promise<boolean> {
  const dbOk = await rt.awaitDb();
  if (dbOk === false) {
    logDatabaseFailure(rt);
    return false;
  }
  const ok = await rt.store.upsertEntity(model, entity);
  if (ok === false) {
    logDatabaseFailure(rt);
    return false;
  }
  const key = entityStoreKey(model.name, entityId);
  rt.pendingEntityWrites.rows = appendItem(rt.pendingEntityWrites.rows, { key, entity });
  rt.entities.delete(key);
  return true;
}

function parseExternalInput<I extends Record<string, ScalarTypeDef>>(
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

function isExternalInput<I extends Record<string, ScalarTypeDef>>(
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

function parseExternalOutput<O extends Record<string, ScalarTypeDef>>(
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

function isExternalOutput<O extends Record<string, ScalarTypeDef>>(
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

type InferFromField<V extends FieldValue> = V extends ScalarTypeDef
  ? InferTypeDef<V>
  : V extends ModelDef<ModelFieldsInput>
    ? string
    : V extends ModelRef
      ? string
      : never;

export type InferFields<F extends FieldsMap> = {
  [K in keyof F]: InferFromField<F[K]>;
};

export type UpdateBody<F extends FieldsMap> = {
  [K in keyof InferFields<F> as K extends SystemFieldKey ? never : K]?: InferFields<F>[K];
};

type WritableBody<F extends FieldsMap> = {
  -readonly [K in keyof InferFields<F>]: InferFields<F>[K];
};

type LogFieldValueKinds = {
  entity: EntityValue;
  filter: FilterInput;
};

type LogFieldValue = LogFieldValueKinds[keyof LogFieldValueKinds];

type ExternalResultKinds<T> = {
  running: { signal: "running" };
  failed: { signal: "failed" };
  done: { signal: "done"; output: T };
};

type ExternalResult<T> = ExternalResultKinds<T>[keyof ExternalResultKinds<T>];

type NestedResultKinds = {
  running: { signal: "running" };
  failed: { signal: "failed" };
  done: { signal: "done" };
  doneEntity: { signal: "done"; id: string; entity: EntityRecord };
  doneList: { signal: "done"; results: EntityRecord[] };
};

export type NestedResult = NestedResultKinds[keyof NestedResultKinds];

export type SystemEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
};

type CreateResultKinds<E extends EntityRecord> = {
  running: { signal: "running"; runId: string };
  failed: { signal: "failed" };
  done: { signal: "done"; id: string; entity: E };
};

export type CreateResult<E extends EntityRecord> = CreateResultKinds<E>[keyof CreateResultKinds<E>];

type FlowObs = {
  log: (message: string, fields: Record<string, LogFieldValue>) => boolean;
  metric: {
    increment(name: string): boolean;
    histogram(name: string, value: number): boolean;
  };
  trace: <TRes>(name: string, run: () => Promise<TRes>) => Promise<TRes>;
};

type FlowModelOps = {
  create(target: ModelRef, body: EntityRecord): Promise<NestedResult>;
  list(target: ModelRef, filter: FilterInput): Promise<NestedResult>;
  update(
    target: ModelRef,
    input: { id: string; body: EntityRecord; filter: FilterInput },
  ): Promise<NestedResult>;
  delete(target: ModelRef, input: { id: string; filter: FilterInput }): Promise<NestedResult>;
};

export type CreateFlow<F extends FieldsMap> = {
  id: string;
  body: WritableBody<F>;
} & FlowObs &
  FlowModelOps & {
    external<I extends Record<string, ScalarTypeDef>, O extends Record<string, ScalarTypeDef>>(
      ext: ExternalDef<I, O>,
      input: InferExternalInputFrom<I>,
    ): Promise<ExternalResult<InferExternalOutputFrom<O>>>;
  };

export type ListFlow<F extends FieldsMap> = FlowObs &
  FlowModelOps & {
    filter: FilterView<F>;
  };

export type UpdateFlow<F extends FieldsMap> = ListFlow<F> & {
  id: string;
  body: EntityRecord;
};

export type DeleteFlow<F extends FieldsMap> = ListFlow<F> & {
  id: string;
};

export interface FlowHandlers<D extends ModelFieldsInput> {
  create(flow: CreateFlow<NormalizeModelFields<D>>): Promise<Signal>;
  list(flow: ListFlow<EntityFieldsOf<D>>): Promise<Signal>;
  update(flow: UpdateFlow<EntityFieldsOf<D>>): Promise<Signal>;
  delete(flow: DeleteFlow<EntityFieldsOf<D>>): Promise<Signal>;
}

export type ModelDef<D extends ModelFieldsInput> = {
  name: string;
  fields: FieldsMap;
  flow: FlowHandlers<D>;
  validateCreateBody: (body: JsonValue) => EntityRecord;
  validateUpdateBody: (body: JsonValue) => EntityRecord;
  validateListFilter: (filter: JsonValue) => FilterInput;
  validateUpdateFilter: (filter: JsonValue) => FilterInput;
  validateDeleteFilter: (filter: JsonValue) => FilterInput;
};

export function flows<D extends ModelFieldsInput>(handlers: FlowHandlers<D>): FlowHandlers<D> {
  const handlerShape = z.instanceof(Function);
  const createHandler = handlers.create;
  const listHandler = handlers.list;
  const updateHandler = handlers.update;
  const deleteHandler = handlers.delete;
  if (handlerShape.safeParse(createHandler).success === false) {
    throw ValidationError.create("flow create handler required");
  }
  if (handlerShape.safeParse(listHandler).success === false) {
    throw ValidationError.create("flow list handler required");
  }
  if (handlerShape.safeParse(updateHandler).success === false) {
    throw ValidationError.create("flow update handler required");
  }
  if (handlerShape.safeParse(deleteHandler).success === false) {
    throw ValidationError.create("flow delete handler required");
  }
  return {
    create: createHandler,
    list: listHandler,
    update: updateHandler,
    delete: deleteHandler,
  };
}

export function Model<const F extends ModelFieldsInput>(config: {
  name: string;
  fields: ModelFieldsInput & F;
  flow: FlowHandlers<F>;
}): ModelDef<F> {
  const domainFields = domainFieldsFrom(config.fields);
  const entityFields = mergeFieldsMaps(domainFields, systemFieldDefs);

  const updateSchema = partialFieldsSchema(domainFields);
  const filterSchema = buildFilterSchema(entityFields);

  return {
    name: config.name,
    fields: entityFields,
    flow: config.flow,
    validateCreateBody: (body) => parseBodyRecord(domainFieldsSchema(domainFields), body),
    validateUpdateBody: (body) => parseBodyRecord(updateSchema, body),
    validateListFilter: (filter) => parseFilter(filterSchema, filter),
    validateUpdateFilter: (filter) => parseFilter(filterSchema, filter),
    validateDeleteFilter: (filter) => parseFilter(filterSchema, filter),
  };
}

type ExternalBackoffKinds = {
  fixed: "fixed";
  exponential: "exponential";
};

type ExternalBackoff = ExternalBackoffKinds[keyof ExternalBackoffKinds];

export type ExternalConfig<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = {
  name: string;
  input: I;
  output: O;
  attempts: number;
  backoff: ExternalBackoff;
};

export interface ExternalDef<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> extends ExternalConfig<I, O> {
  validateInput(value: JsonValue): InferExternalInputFrom<I>;
  validateOutput(value: JsonValue): InferExternalOutputFrom<O>;
}

export function External<
  const I extends Record<string, ScalarTypeDef>,
  const O extends Record<string, ScalarTypeDef>,
>(config: ExternalConfig<I, O>): ExternalDef<I, O> {
  let attempts = 0;
  if (Number.isInteger(config.attempts) === true && config.attempts >= 1) {
    attempts = config.attempts;
  }
  let backoff: ExternalBackoff = "fixed";
  if (config.backoff === "fixed" || config.backoff === "exponential") {
    backoff = config.backoff;
  }
  return {
    name: config.name,
    input: config.input,
    output: config.output,
    attempts,
    backoff,
    validateInput: (inputJson) => parseExternalInput(config.input, inputJson),
    validateOutput: (outputJson) => parseExternalOutput(config.output, outputJson),
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

type LogEntry = {
  level: string;
  message: string;
  traceId: string;
  model: string;
  entityId: string;
  operation: string;
  timestamp: string;
  fields: Record<string, LogFieldValue>;
};

type MetricEntry = {
  name: string;
  value: number;
  traceId: string;
  model: string;
  timestamp: string;
};

type SpanEntry = {
  name: string;
  traceId: string;
  model: string;
  entityId: string;
  operation: string;
  startedAt: string;
  endedAt: string;
};

type PendingExternalEvent = {
  externalId: string;
  name: string;
  input: EntityRecord;
};

type PendingEntityWrite = {
  key: string;
  entity: EntityRecord;
};

type PendingWriteQueue = {
  rows: readonly PendingEntityWrite[];
};

type PendingEventQueue = {
  events: readonly PendingExternalEvent[];
};

const observabilityBufferLimit = 10_000;
const runBufferLimit = 10_000;

function pushBounded<T>(buffer: readonly T[], bufferItem: T): T[] {
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

type ObsBuffers = {
  logs: readonly LogEntry[];
  metrics: readonly MetricEntry[];
  spans: readonly SpanEntry[];
};

type ObsScope = {
  traceId: string;
  model: string;
  entityId: string;
  operation: string;
};

class Observability {
  readonly buffers: ObsBuffers = { logs: [], metrics: [], spans: [] };
  private readonly tracer = trace.getTracer("fookie");
  private readonly meter = otelMetrics.getMeter("fookie");
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();

  info(scope: ObsScope, message: string, fields: Record<string, LogFieldValue>): void {
    const logEntry: LogEntry = {
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
          name,
          traceId: scope.traceId,
          model: scope.model,
          entityId: scope.entityId,
          operation: scope.operation,
          startedAt,
          endedAt: isoNow(),
        });
      }
    });
  }

  private record(scope: ObsScope, name: string, metricAmount: number): void {
    this.buffers.metrics = pushBounded(this.buffers.metrics, {
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

type Runtime<E extends readonly ExternalDef[] = readonly ExternalDef[]> = {
  traceId: string;
  model: ModelDef<ModelFieldsInput>;
  entityId: string;
  operation: string;
  obs: Observability;
  outbox: Map<string, OutboxEntry>;
  onExternalEvent: (event: ExternalEventOf<E[number]>) => Promise<void>;
  models: ReadonlyArray<ModelDef<ModelFieldsInput>>;
  externals: E;
  resume: (runId: string) => Promise<Signal>;
  entities: Map<string, EntityRecord>;
  pool: InjectablePool;
  store: PostgresStore;
  awaitDb: () => Promise<boolean>;
  reportDbError: (message: string) => void;
  clearDbError: () => void;
  dbLastError: () => readonly string[];
  listResults: EntityRecord[];
  pendingExternalEvents: PendingEventQueue;
  pendingEntityWrites: PendingWriteQueue;
};

type OutboxEntry<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = {
  externalId: string;
  name: string;
  entityId: string;
  model: string;
  runId: string;
  attempt: number;
  input: InferExternalInputFrom<I>;
} & OutboxStatusPayloadKinds<O>[keyof OutboxStatusPayloadKinds<O>];

type OutboxStatusPayloadKinds<O extends Record<string, ScalarTypeDef>> = {
  pending: { status: OutboxPendingStatus };
  failed: { status: OutboxFailedStatus };
  completed: { status: OutboxCompletedStatus; output: InferExternalOutputFrom<O> };
};

type EntityRecordSourceKinds = {
  json: JsonObject;
  entity: EntityRecord;
  writable: WritableJsonObject;
  entityMap: Record<string, EntityValue>;
};
type EntityRecordSource = EntityRecordSourceKinds[keyof EntityRecordSourceKinds];

function entityRecordFromPlain(raw: EntityRecordSource): EntityRecord {
  const wireParsed = z.record(z.string(), jsonWireSchema).safeParse(raw);
  if (wireParsed.success === false) {
    return {};
  }
  const entity: EntityRecord = {};
  for (const [key, value] of Object.entries(wireParsed.data)) {
    if (isEntityValue(value)) {
      entity[key] = value;
    }
  }
  return entity;
}

function entityRecordFromUpdateBody<D extends ModelFieldsInput>(
  body: UpdateBody<EntityFieldsOf<D>>,
): EntityRecord {
  const next: WritableJsonObject = {};
  for (const [key, value] of Object.entries(body)) {
    const parsed = jsonWireSchema.safeParse(value);
    if (parsed.success === true) {
      next[key] = parsed.data;
    }
  }
  return entityRecordFromPlain(next);
}

function entityRecordFromJson(raw: HostValue): readonly EntityRecord[] {
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

function requireEntityRecord(hits: readonly EntityRecord[], message: string): EntityRecord {
  for (const hit of hits) {
    if (z.string().min(1).safeParse(message).success === false) {
      throw ValidationError.create("entity record message required");
    }
    return hit;
  }
  throw ValidationError.create(message);
}

function firstPresent<T>(hits: readonly T[], message: string): T {
  if (hits.length < 1) {
    throw ValidationError.create(message);
  }
  for (const hit of hits) {
    if (z.string().min(1).safeParse(message).success === false) {
      throw ValidationError.create("present value message required");
    }
    return hit;
  }
  throw ValidationError.create(message);
}

function firstFilterGroup(groups: readonly FilterGroup[]): FilterGroup {
  if (groups.length < 1) {
    throw ModelFieldError.create("filter group required");
  }
  for (const group of groups) {
    if (z.string().min(1).safeParse(group).success === false) {
      throw ModelFieldError.create("filter group required");
    }
    return group;
  }
  throw ModelFieldError.create("filter group required");
}

function pgCellToString(raw: HostValue): string {
  const cell = pgCellValue(raw);
  const asString = z.string().safeParse(cell);
  if (asString.success === false) {
    throw PgEncodeError.create("cell is not a string");
  }
  if (asString.data.length < 1) {
    throw PgEncodeError.create("cell is not a string");
  }
  return asString.data;
}

function isOutboxStatus(statusText: string): statusText is OutboxStatus {
  if (statusText === OutboxPending) {
    return true;
  }
  if (statusText === OutboxFailed) {
    return true;
  }
  if (statusText === OutboxCompleted) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
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

function backoffDelayMs(backoff: ExternalBackoff, attempt: number): number {
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

function obsScope(rt: Runtime): ObsScope {
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
  };
}

type LogLineFieldKinds = {
  log: LogFieldValue;
  text: string;
};

type LogLineField = LogLineFieldKinds[keyof LogLineFieldKinds];

function logLineFromEntry(logEntry: LogEntry): string {
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

type EmitExternalResultKinds = {
  emitted: "emitted";
  invalid_input: "invalid_input";
  handler_error: "handler_error";
};

type EmitExternalResult = EmitExternalResultKinds[keyof EmitExternalResultKinds];

async function emitExternalHandler<E extends readonly ExternalDef[]>(
  handler: (event: ExternalEventOf<E[number]>) => Promise<void>,
  ext: ExternalDef,
  externalId: string,
  input: EntityRecord,
): Promise<EmitExternalResult> {
  const parsedHits = catchValidation(() => parseExternalInput(ext.input, input));
  if (parsedHits.length < 1) {
    return "invalid_input";
  }
  const parsed = firstPresent(parsedHits, "external input required");
  try {
    await handler({
      externalId,
      name: ext.name,
      input: parsed,
    });
  } catch {
    return "handler_error";
  }
  return "emitted";
}

function clearPendingWork(rt: Runtime): void {
  if (z.looseObject({}).safeParse(rt).success === false) {
    throw ValidationError.create("runtime required");
  }
  for (const event of rt.pendingExternalEvents.events) {
    if (z.string().min(1).safeParse(event.externalId).success === false) {
      throw ValidationError.create("pending external id required");
    }
    rt.outbox.delete(event.externalId);
  }
  rt.pendingExternalEvents.events = [];
  rt.pendingEntityWrites.rows = [];
}

function flushPendingEntityWrites(rt: Runtime): void {
  const writes = rt.pendingEntityWrites.rows;
  rt.pendingEntityWrites.rows = [];
  for (const write of writes) {
    let deletedTrues: readonly true[] = [];
    for (const deleted of entityValueAt(write.entity, "isDeleted")) {
      if (deleted === true) {
        deletedTrues = appendItem(deletedTrues, true);
      }
    }
    if (deletedTrues.length > 0) {
      rt.entities.delete(write.key);
    } else {
      rt.entities.set(write.key, write.entity);
    }
  }
}

async function failClosePendingOutbox(rt: Runtime, externalId: string): Promise<boolean> {
  for (const previous of mapLookup(rt.outbox, externalId)) {
    if (previous.status === "failed") {
      return true;
    }
    if (previous.status !== "pending") {
      return false;
    }
    const failed = outboxFailed(previous);
    rt.outbox.set(externalId, failed);
    const ok = await rt.store.saveOutboxEntry(failed);
    if (ok === false) {
      rt.outbox.set(externalId, previous);
      return false;
    }
    return true;
  }
  return false;
}

async function flushPendingExternalEvents(rt: Runtime): Promise<boolean> {
  const scope = obsScope(rt);
  let flushed = true;
  while (rt.pendingExternalEvents.events.length > 0) {
    const event = firstPresent(rt.pendingExternalEvents.events, "pending external event required");
    const extHits = resolveExternalByName(rt.externals, event.name);
    if (extHits.length < 1) {
      rt.obs.error(scope, "external.emit_skipped", {
        reason: "unknown external",
        name: event.name,
        externalId: event.externalId,
      });
      const closed = await failClosePendingOutbox(rt, event.externalId);
      if (closed === true) {
        rt.obs.count(scope, "external.failed");
        rt.obs.info(scope, "external.failed", {
          externalId: event.externalId,
          reason: "unknown external",
        });
      }
      flushed = false;
      rt.pendingExternalEvents.events = rt.pendingExternalEvents.events.slice(1);
      continue;
    }
    const ext = firstPresent(extHits, "external required");
    const emitted = await emitExternalHandler(
      rt.onExternalEvent,
      ext,
      event.externalId,
      event.input,
    );
    if (emitted !== "emitted") {
      let alreadyCompleted = false;
      for (const acked of mapLookup(rt.outbox, event.externalId)) {
        if (acked.status === "completed") {
          alreadyCompleted = true;
        }
      }
      if (alreadyCompleted === true) {
        rt.pendingExternalEvents.events = rt.pendingExternalEvents.events.slice(1);
        continue;
      }
      const reason = emitted === "handler_error" ? "handler error" : "invalid input";
      rt.obs.error(scope, "external.emit_skipped", {
        reason,
        name: event.name,
        externalId: event.externalId,
      });
      const closed = await failClosePendingOutbox(rt, event.externalId);
      if (closed === true) {
        rt.obs.count(scope, "external.failed");
        rt.obs.info(scope, "external.failed", {
          externalId: event.externalId,
          reason,
        });
      }
      flushed = false;
    }
    rt.pendingExternalEvents.events = rt.pendingExternalEvents.events.slice(1);
  }
  return flushed;
}

function resolveExternalByName<E extends readonly ExternalDef[]>(
  externals: E,
  name: string,
): E[number][] {
  if (Array.isArray(externals) === false) {
    throw ValidationError.create("externals list required");
  }
  if (z.string().min(1).safeParse(name).success === false) {
    throw ValidationError.create("external name required");
  }
  for (const ext of externals) {
    if (ext.name === name) {
      return [ext];
    }
  }
  return [];
}

function transactionRuntime(rt: Runtime, client: PgClient): Runtime {
  const store = rt.store.withClient(client);
  return {
    traceId: rt.traceId,
    model: rt.model,
    entityId: rt.entityId,
    operation: rt.operation,
    obs: rt.obs,
    outbox: rt.outbox,
    onExternalEvent: rt.onExternalEvent,
    models: rt.models,
    externals: rt.externals,
    resume: rt.resume,
    entities: rt.entities,
    pool: rt.pool,
    store,
    awaitDb: rt.awaitDb,
    reportDbError: rt.reportDbError,
    clearDbError: rt.clearDbError,
    dbLastError: rt.dbLastError,
    listResults: rt.listResults,
    pendingEntityWrites: { rows: [] },
    pendingExternalEvents: { events: [] },
  };
}

async function withWriteTransaction(
  rt: Runtime,
  run: (txRt: Runtime) => Promise<Signal>,
): Promise<Signal> {
  let client: PgClient;
  try {
    client = await rt.pool.connect();
  } catch (err) {
    rt.reportDbError(dbErrorMessageForLog(err, "database unavailable"));
    return Failed;
  }
  const txRt: Runtime = transactionRuntime(rt, client);
  let committed = false;
  let signal: Signal = Failed;
  try {
    await client.query("BEGIN");
    signal = await run(txRt);
    if (signal === Failed) {
      clearPendingWork(txRt);
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
      committed = true;
      flushPendingEntityWrites(txRt);
      const flushed = await flushPendingExternalEvents(txRt);
      if (flushed === false && signal === Running) {
        return Failed;
      }
    }
    return signal;
  } catch (err) {
    if (committed === true) {
      return signal;
    }
    rt.reportDbError(dbErrorMessageForLog(err, "database unavailable"));
    try {
      clearPendingWork(txRt);
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      rt.reportDbError(dbErrorMessageForLog(rollbackErr, "database unavailable"));
      return Failed;
    }
    return Failed;
  } finally {
    client.release();
  }
}

function emptyFilterInput(): FilterInput {
  const filter: FilterInput = {};
  const probe = z.record(z.string(), z.object({}).partial()).safeParse(filter);
  if (probe.success === false) {
    throw ValidationError.create("empty filter invalid");
  }
  if (Object.keys(filter).length > 0) {
    throw ValidationError.create("empty filter invalid");
  }
  return filter;
}

function resolveModel(rt: Runtime, target: ModelRef): readonly ModelDef<ModelFieldsInput>[] {
  if (z.looseObject({}).safeParse(rt).success === false) {
    throw ValidationError.create("runtime required");
  }
  if (z.string().min(1).safeParse(target.name).success === false) {
    throw ValidationError.create("model name required");
  }
  for (const model of rt.models) {
    if (model.name === target.name) {
      return [model];
    }
  }
  return [];
}

function requireModel(
  hits: readonly ModelDef<ModelFieldsInput>[],
  message: string,
): ModelDef<ModelFieldsInput> {
  for (const hit of hits) {
    if (z.string().min(1).safeParse(message).success === false) {
      throw ValidationError.create("model message required");
    }
    return hit;
  }
  throw ValidationError.create(message);
}

function createFlowModelOps(
  rt: Runtime,
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
  obs: ReturnType<typeof createObservability>,
): FlowObs & FlowModelOps {
  return {
    log: obs.log,
    metric: obs,
    trace: (name, run) => traceSpan(rt, name, run),
    create(target, body) {
      const childHits = resolveModel(rt, target);
      if (childHits.length < 1) {
        return Promise.resolve({ signal: Failed });
      }
      const child = requireModel(childHits, "nested model missing");
      if (z.looseObject({}).safeParse(child).success === false) {
        return Promise.resolve({ signal: Failed });
      }
      return runCreate(rt, child, body, parent, parentEntityId);
    },
    list(target, filter) {
      const childHits = resolveModel(rt, target);
      if (childHits.length < 1) {
        return Promise.resolve({ signal: Failed });
      }
      const child = requireModel(childHits, "nested model missing");
      if (z.looseObject({}).safeParse(child).success === false) {
        return Promise.resolve({ signal: Failed });
      }
      return runNestedList(rt, child, filter, parent, parentEntityId);
    },
    update(target, input) {
      const childHits = resolveModel(rt, target);
      if (childHits.length < 1) {
        return Promise.resolve({ signal: Failed });
      }
      const child = requireModel(childHits, "nested model missing");
      if (z.looseObject({}).safeParse(child).success === false) {
        return Promise.resolve({ signal: Failed });
      }
      return runNestedUpdate(rt, child, input, parent, parentEntityId);
    },
    delete(target, input) {
      const childHits = resolveModel(rt, target);
      if (childHits.length < 1) {
        return Promise.resolve({ signal: Failed });
      }
      const child = requireModel(childHits, "nested model missing");
      if (z.looseObject({}).safeParse(child).success === false) {
        return Promise.resolve({ signal: Failed });
      }
      return runNestedDelete(rt, child, input, parent, parentEntityId);
    },
  };
}

function flowOpsOf(ops: FlowObs & FlowModelOps): FlowObs & FlowModelOps {
  if (z.looseObject({}).safeParse(ops).success === false) {
    throw ValidationError.create("flow ops required");
  }
  if (z.instanceof(Function).safeParse(ops.create).success === false) {
    throw ValidationError.create("flow create op required");
  }
  return {
    log: ops.log,
    metric: ops.metric,
    trace: ops.trace,
    create: ops.create,
    list: ops.list,
    update: ops.update,
    delete: ops.delete,
  };
}

function createFlowOf<F extends FieldsMap>(
  id: string,
  body: WritableBody<F>,
  ops: FlowObs & FlowModelOps,
  external: CreateFlow<F>["external"],
): CreateFlow<F> {
  const flowOps = flowOpsOf(ops);
  return {
    id,
    body,
    log: flowOps.log,
    metric: flowOps.metric,
    trace: flowOps.trace,
    create: flowOps.create,
    list: flowOps.list,
    update: flowOps.update,
    delete: flowOps.delete,
    external,
  };
}

function listFlowOf<F extends FieldsMap>(
  filter: FilterView<F>,
  ops: FlowObs & FlowModelOps,
): ListFlow<F> {
  const flowOps = flowOpsOf(ops);
  return {
    filter,
    log: flowOps.log,
    metric: flowOps.metric,
    trace: flowOps.trace,
    create: flowOps.create,
    list: flowOps.list,
    update: flowOps.update,
    delete: flowOps.delete,
  };
}

function updateFlowOf<F extends FieldsMap>(
  id: string,
  body: EntityRecord,
  filter: FilterView<F>,
  ops: FlowObs & FlowModelOps,
): UpdateFlow<F> {
  const flowOps = flowOpsOf(ops);
  return {
    id,
    body,
    filter,
    log: flowOps.log,
    metric: flowOps.metric,
    trace: flowOps.trace,
    create: flowOps.create,
    list: flowOps.list,
    update: flowOps.update,
    delete: flowOps.delete,
  };
}

function deleteFlowOf<F extends FieldsMap>(
  id: string,
  filter: FilterView<F>,
  ops: FlowObs & FlowModelOps,
): DeleteFlow<F> {
  const flowOps = flowOpsOf(ops);
  return {
    id,
    filter,
    log: flowOps.log,
    metric: flowOps.metric,
    trace: flowOps.trace,
    create: flowOps.create,
    list: flowOps.list,
    update: flowOps.update,
    delete: flowOps.delete,
  };
}

function uuidV7(): string {
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

function externalId<I extends Record<string, ScalarTypeDef>>(
  entityId: string,
  name: string,
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
  return `${entityId}:${name}:${parts.join(",")}`;
}

function createObservability(rt: Runtime) {
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

function traceSpan<T>(rt: Runtime, name: string, run: () => Promise<T>): Promise<T> {
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

async function runExternal<
  I extends Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef>,
>(
  rt: Runtime,
  ext: ExternalDef<I, O>,
  input: InferExternalInputFrom<I>,
): Promise<ExternalResult<InferExternalOutputFrom<O>>> {
  const validatedHits = catchValidation(() => ext.validateInput(input));
  if (validatedHits.length < 1) {
    return { signal: Failed };
  }
  const validated = firstPresent(validatedHits, "external input required");

  const id = externalId(rt.entityId, ext.name, validated);
  const scope = obsScope(rt);
  return await rt.obs.runSpan(
    scope,
    ext.name,
    { externalName: ext.name, externalId: id },
    async (span) => {
      const existing = mapLookup(rt.outbox, id);
      const completedEntries = existing.filter(
        (outboxEntry) => outboxEntry.status === "completed",
      );
      const outputValidHits = catchValidation(() => {
        const completedEntry = firstPresent(completedEntries, "completed outbox entry required");
        if (completedEntry.status !== "completed") {
          throw ValidationError.create("completed outbox entry required");
        }
        if (completedEntry.name !== ext.name) {
          throw ValidationError.create("outbox external mismatch");
        }
        return parseExternalOutput(ext.output, completedEntry.output);
      });

      for (const outboxHit of existing) {
        if (outboxHit.status === "completed") {
          if (outputValidHits.length < 1) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: "external output invalid" });
            return { signal: Failed };
          }
          const outputValid = firstPresent(outputValidHits, "external output required");
          span.setAttribute("signal", Done);
          return {
            output: outputValid,
            signal: Done,
          };
        }
        if (outboxHit.status === "failed") {
          span.setAttribute("signal", Failed);
          span.setStatus({ code: SpanStatusCode.ERROR, message: "external failed" });
          return { signal: Failed };
        }
      }

      if (existing.length < 1) {
        const pending = outboxPendingEntry(
          id,
          ext.name,
          validated,
          rt.entityId,
          rt.model.name,
          rt.traceId,
          1,
        );
        rt.outbox.set(id, pending);
        const saved = await rt.store.saveOutboxEntry(pending);
        if (saved === false) {
          rt.outbox.delete(id);
          logDatabaseFailure(rt);
          span.setAttribute("signal", Failed);
          span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
          return { signal: Failed };
        }
        rt.obs.count(scope, "external.dispatched");
        rt.obs.info(scope, "external.dispatch", { externalId: id, externalName: ext.name });
        rt.pendingExternalEvents.events = appendItem(rt.pendingExternalEvents.events, {
          externalId: id,
          name: ext.name,
          input: validated,
        });
      }

      span.setAttribute("signal", Running);
      return { signal: Running };
    },
  );
}

type FlowOperationKinds = {
  create: "create";
  list: "list";
  update: "update";
  delete: "delete";
};

type FlowOperation = FlowOperationKinds[keyof FlowOperationKinds];

type FlowRun<D extends ModelFieldsInput = ModelFieldsInput> = {
  id: string;
  model: ModelDef<D>;
  operation: FlowOperation;
  entityId: string;
  body: readonly EntityRecord[];
  filter: readonly FilterState[];
  entity: readonly EntityRecord[];
  created: readonly EntityRecord[];
  results: EntityRecord[];
  signal: Signal;
};

function copyFilterState(source: FilterInput): FilterState {
  if (z.looseObject({}).safeParse(source).success === false) {
    throw ValidationError.create("filter required");
  }
  const next: FilterState = {};
  for (const [key, field] of Object.entries(source)) {
    if (z.string().min(1).safeParse(key).success === false) {
      throw ValidationError.create("filter field key required");
    }
    next[key] = copyFilterField(field);
  }
  return next;
}

function runtimeOf(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  operation: string,
  store: PostgresStore,
): Runtime {
  return {
    traceId: rt.traceId,
    model,
    entityId,
    operation,
    obs: rt.obs,
    outbox: rt.outbox,
    onExternalEvent: rt.onExternalEvent,
    models: rt.models,
    externals: rt.externals,
    resume: rt.resume,
    entities: rt.entities,
    pool: rt.pool,
    store,
    awaitDb: rt.awaitDb,
    reportDbError: rt.reportDbError,
    clearDbError: rt.clearDbError,
    dbLastError: rt.dbLastError,
    listResults: rt.listResults,
    pendingExternalEvents: rt.pendingExternalEvents,
    pendingEntityWrites: rt.pendingEntityWrites,
  };
}

function scopedRuntime(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  operation: string,
): Runtime {
  if (z.string().min(1).safeParse(entityId).success === false) {
    throw ValidationError.create("scoped runtime entity id required");
  }
  if (z.string().min(1).safeParse(operation).success === false) {
    throw ValidationError.create("scoped runtime operation required");
  }
  const next = runtimeOf(rt, model, entityId, operation, rt.store);
  return next;
}

function bindRelationFields(
  child: ModelDef<ModelFieldsInput>,
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
  body: EntityRecord,
): EntityRecord {
  const next = entityRecordFromPlain(body);
  const fields = domainFieldsFrom(child.fields);
  for (const [key, value] of Object.entries(fields)) {
    if (isRelationField(value) && value.name === parent.name) {
      next[key] = parentEntityId;
    }
  }
  return next;
}

function bindRelationFilter(
  child: ModelDef<ModelFieldsInput>,
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
  filter: FilterState,
): FilterState {
  const next = copyFilterState(filter);
  const fields = domainFieldsFrom(child.fields);
  for (const [key, value] of Object.entries(fields)) {
    if (isRelationField(value) && value.name === parent.name) {
      assignFilterOp(next, key, "eq", parentEntityId);
    }
  }
  return next;
}

function entityMatchesParentRelation(
  child: ModelDef<ModelFieldsInput>,
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
  entity: EntityRecord,
): boolean {
  const fields = domainFieldsFrom(child.fields);
  for (const [key, value] of Object.entries(fields)) {
    if (isRelationField(value) && value.name === parent.name) {
      const relatedValues = entityValueAt(entity, key);
      if (relatedValues.length < 1) {
        return false;
      }
      for (const related of relatedValues) {
        if (related !== parentEntityId) {
          return false;
        }
      }
    }
  }
  return true;
}

async function runCreate<D extends ModelFieldsInput>(
  rt: Runtime,
  model: ModelDef<D>,
  body: EntityRecord,
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
): Promise<NestedResult> {
  const bound = bindRelationFields(model, parent, parentEntityId, body);
  const validatedHits = catchValidation(() => model.validateCreateBody(bound));
  if (validatedHits.length < 1) {
    return { signal: Failed };
  }
  const validated = firstPresent(validatedHits, "validated body required");
  if (isCreateBody(model, validated) === false) {
    return { signal: Failed };
  }

  const entityId = uuidV7();
  const flowBody: WritableBody<NormalizeModelFields<D>> = validated;

  const localRt = scopedRuntime(rt, model, entityId, "create");
  const obs = createObservability(localRt);
  const ops = createFlowModelOps(localRt, model, entityId, obs);
  const flow = createFlowOf<NormalizeModelFields<D>>(entityId, flowBody, ops, (ext, input) =>
    runExternal(localRt, ext, input),
  );

  const signal = await localRt.obs.runSpan(
    obsScope(localRt),
    `${model.name.toLowerCase()}.create`,
    {},
    () => model.flow.create(flow),
  );

  if (signal === Done) {
    const stored = createdEntity(
      entityId,
      mergeUpdateBody(model, entityRecordFromPlain(flow.body)),
    );
    const ok = await persistEntity(rt, model, entityId, stored);
    if (ok === false) {
      return { signal: Failed };
    }
    localRt.obs.count(obsScope(localRt), "nested.create");
    return { signal: Done, id: entityId, entity: stored };
  }
  return toNestedResult(signal);
}

function toNestedResult(signal: Signal): NestedResult {
  if (signal === Done) {
    return { signal: Done };
  }
  if (signal === Running) {
    return { signal: Running };
  }
  return { signal: Failed };
}

async function runNestedList(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  filter: FilterInput,
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
): Promise<NestedResult> {
  const validatedHits = catchValidation(() => model.validateListFilter(filter));
  if (validatedHits.length < 1) {
    return { signal: Failed };
  }
  const validated = firstPresent(validatedHits, "nested list filter required");

  const filterState = bindRelationFilter(
    model,
    parent,
    parentEntityId,
    copyFilterState(validated),
  );
  const localRt = scopedRuntime(rt, model, parentEntityId, "list");
  const obs = createObservability(localRt);
  const ops = createFlowModelOps(localRt, parent, parentEntityId, obs);
  const flow = listFlowOf(createFilter(model.fields, filterState), ops);

  const signal = await localRt.obs.runSpan(
    obsScope(localRt),
    `${model.name.toLowerCase()}.list`,
    {},
    () => model.flow.list(flow),
  );
  if (signal === Done) {
    try {
      const rows = await rt.store.queryEntities(model, filterState);
      localRt.obs.count(obsScope(localRt), "nested.list");
      return { signal: Done, results: rows };
    } catch (err) {
      if (err instanceof DatabaseError || err instanceof PgEncodeError) {
        logDatabaseFailure(rt);
      }
      return { signal: Failed };
    }
  }
  return toNestedResult(signal);
}

async function runNestedUpdate<D extends ModelFieldsInput>(
  rt: Runtime,
  model: ModelDef<D>,
  input: { id: string; body: EntityRecord; filter: FilterInput },
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
): Promise<NestedResult> {
  const filterValidHits = catchValidation(() => model.validateUpdateFilter(input.filter));
  const bodyValidHits = catchValidation(() => model.validateUpdateBody(input.body));
  if (filterValidHits.length < 1 || bodyValidHits.length < 1) {
    return { signal: Failed };
  }
  const filterValid = firstPresent(filterValidHits, "nested update filter required");
  const bodyValid = firstPresent(bodyValidHits, "nested update body required");
  const updateBody = mergeUpdateBody(model, bodyValid);

  const localRt = scopedRuntime(rt, model, input.id, "update");
  const obs = createObservability(localRt);
  const filterState = copyFilterState(filterValid);
  const ops = createFlowModelOps(localRt, model, input.id, obs);
  let existing: EntityRecord;
  try {
    existing = await getEntity(rt, model, input.id);
  } catch {
    return { signal: Failed };
  }
  if (existing.id !== input.id) {
    return { signal: Failed };
  }
  if (entityMatchesParentRelation(model, parent, parentEntityId, existing) === false) {
    return { signal: Failed };
  }
  if (entityMatchesFilter(model, existing, filterValid) === false) {
    return { signal: Failed };
  }
  const flow = updateFlowOf<EntityFieldsOf<D>>(
    input.id,
    updateBody,
    createFilter(model.fields, filterState),
    ops,
  );

  const signal = await localRt.obs.runSpan(
    obsScope(localRt),
    `${model.name.toLowerCase()}.update`,
    {},
    () => model.flow.update(flow),
  );
  if (signal === Done) {
    const stored = bindRelationFields(
      model,
      parent,
      parentEntityId,
      stampUpdate(
        existing,
        mergeUpdateBody(model, entityRecordFromPlain(mergeEntityRecords(bodyValid, flow.body))),
      ),
    );
    if (
      entityMatchesFilter(model, existing, filterState) === false &&
      entityMatchesFilter(model, stored, filterState) === false
    ) {
      return { signal: Failed };
    }
    const ok = await persistEntity(rt, model, input.id, stored);
    if (ok === false) {
      return { signal: Failed };
    }
    localRt.obs.count(obsScope(localRt), "nested.update");
  }
  return toNestedResult(signal);
}

async function runNestedDelete(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  input: { id: string; filter: FilterInput },
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
): Promise<NestedResult> {
  const filterValidHits = catchValidation(() => model.validateDeleteFilter(input.filter));
  if (filterValidHits.length < 1) {
    return { signal: Failed };
  }
  const filterValid = firstPresent(filterValidHits, "filter required");

  let existing: EntityRecord;
  try {
    existing = await getEntity(rt, model, input.id);
  } catch {
    return { signal: Failed };
  }
  if (existing.id !== input.id) {
    return { signal: Failed };
  }
  if (entityMatchesParentRelation(model, parent, parentEntityId, existing) === false) {
    return { signal: Failed };
  }
  if (entityMatchesFilter(model, existing, filterValid) === false) {
    return { signal: Failed };
  }
  const localRt = scopedRuntime(rt, model, input.id, "delete");
  const obs = createObservability(localRt);
  const filterState = copyFilterState(filterValid);
  const ops = createFlowModelOps(localRt, model, input.id, obs);
  const flow = deleteFlowOf(input.id, createFilter(model.fields, filterState), ops);

  const signal = await localRt.obs.runSpan(
    obsScope(localRt),
    `${model.name.toLowerCase()}.delete`,
    {},
    () => model.flow.delete(flow),
  );
  if (signal === Done) {
    if (entityMatchesFilter(model, existing, filterState) === false) {
      return { signal: Failed };
    }
    const stored = stampSoftDelete(existing);
    const ok = await persistEntity(rt, model, input.id, stored);
    if (ok === false) {
      return { signal: Failed };
    }
    localRt.obs.count(obsScope(localRt), "nested.delete");
  }
  return toNestedResult(signal);
}

async function executeRunMutation<D extends ModelFieldsInput>(
  rt: Runtime,
  run: FlowRun<D>,
): Promise<Signal> {
  if (run.operation === "create") {
    if (run.body.length < 1) {
      return Failed;
    }
    const createBodyInput = firstPresent(run.body, "create body required");
    const validatedHits = catchValidation(() => run.model.validateCreateBody(createBodyInput));
    if (validatedHits.length < 1) {
      return Failed;
    }
    const validated = firstPresent(validatedHits, "validated body required");
    if (isCreateBody(run.model, validated) === false) {
      return Failed;
    }

    const createBody: WritableBody<NormalizeModelFields<D>> = validated;
    const localRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
    const obs = createObservability(localRt);
    const ops = createFlowModelOps(localRt, run.model, run.entityId, obs);
    const flow = createFlowOf<NormalizeModelFields<D>>(
      run.entityId,
      createBody,
      ops,
      (ext, input) => runExternal(localRt, ext, input),
    );

    const signal = await run.model.flow.create(flow);
    if (signal === Done) {
      const stored = createdEntity(
        run.entityId,
        mergeUpdateBody(run.model, entityRecordFromPlain(flow.body)),
      );
      const ok = await persistEntity(rt, run.model, run.entityId, stored);
      if (ok === false) {
        return Failed;
      }
      run.entity = [stored];
      run.created = [stored];
    }
    return signal;
  }

  if (run.operation === "update") {
    if (run.body.length < 1 || run.filter.length < 1) {
      return Failed;
    }
    const updateFilterInput = firstPresent(run.filter, "update filter required");
    const updateBodyInput = firstPresent(run.body, "update body required");
    const filterValidHits = catchValidation(() => run.model.validateUpdateFilter(updateFilterInput));
    const bodyValidHits = catchValidation(() => run.model.validateUpdateBody(updateBodyInput));
    if (filterValidHits.length < 1 || bodyValidHits.length < 1) {
      return Failed;
    }
    const filterValid = firstPresent(filterValidHits, "update filter required");
    const bodyValid = firstPresent(bodyValidHits, "update body required");
    const updateBody = mergeUpdateBody(run.model, bodyValid);
    const localRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
    const obs = createObservability(localRt);
    const filterState = copyFilterState(filterValid);
    const ops = createFlowModelOps(localRt, run.model, run.entityId, obs);
    const flow = updateFlowOf<EntityFieldsOf<D>>(
      run.entityId,
      updateBody,
      createFilter(run.model.fields, filterState),
      ops,
    );
    let existing: EntityRecord;
    try {
      existing = await getEntity(rt, run.model, run.entityId);
    } catch {
      return Failed;
    }
    if (existing.id !== run.entityId) {
      return Failed;
    }
    if (entityMatchesFilter(run.model, existing, filterValid) === false) {
      return Failed;
    }
    run.entity = [existing];
    const signal = await run.model.flow.update(flow);
    if (signal === Done) {
      const stored = stampUpdate(
        existing,
        mergeUpdateBody(
          run.model,
          entityRecordFromPlain(mergeEntityRecords(bodyValid, flow.body)),
        ),
      );
      if (
        entityMatchesFilter(run.model, existing, filterState) === false &&
        entityMatchesFilter(run.model, stored, filterState) === false
      ) {
        return Failed;
      }
      const ok = await persistEntity(rt, run.model, run.entityId, stored);
      if (ok === false) {
        return Failed;
      }
      run.entity = [stored];
    }
    return signal;
  }

  if (run.filter.length < 1) {
    return Failed;
  }
  const deleteFilterInput = firstPresent(run.filter, "delete filter required");
  const filterValidHits = catchValidation(() => run.model.validateDeleteFilter(deleteFilterInput));
  if (filterValidHits.length < 1) {
    return Failed;
  }
  const filterValid = firstPresent(filterValidHits, "filter required");
  const localRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
  const obs = createObservability(localRt);
  const filterState = copyFilterState(filterValid);
  const ops = createFlowModelOps(localRt, run.model, run.entityId, obs);
  const flow = deleteFlowOf<EntityFieldsOf<D>>(
    run.entityId,
    createFilter(run.model.fields, filterState),
    ops,
  );
  let existing: EntityRecord;
  try {
    existing = await getEntity(rt, run.model, run.entityId);
  } catch {
    return Failed;
  }
  if (existing.id !== run.entityId) {
    return Failed;
  }
  if (entityMatchesFilter(run.model, existing, filterValid) === false) {
    return Failed;
  }
  run.entity = [existing];
  const signal = await run.model.flow.delete(flow);
  if (signal === Done) {
    if (entityMatchesFilter(run.model, existing, filterState) === false) {
      return Failed;
    }
    const stored = stampSoftDelete(existing);
    const ok = await persistEntity(rt, run.model, run.entityId, stored);
    if (ok === false) {
      return Failed;
    }
    run.entity = [stored];
  }
  return signal;
}

function reportDatabaseFailure(rt: Runtime): void {
  const scope = obsScope(rt);
  const reason = textOrFallback(rt.dbLastError(), "database unavailable");
  if (z.string().min(1).safeParse(reason).success === false) {
    throw DatabaseError.create("database unavailable");
  }
  rt.obs.error(scope, "database unavailable", { reason });
  rt.obs.count(scope, "operation.failed");
}

function logDatabaseFailure(rt: Runtime): void {
  const scope = obsScope(rt);
  const reason = textOrFallback(rt.dbLastError(), "database unavailable");
  if (z.string().min(1).safeParse(reason).success === false) {
    throw DatabaseError.create("database unavailable");
  }
  if (z.looseObject({}).safeParse(scope).success === false) {
    throw DatabaseError.create("database unavailable");
  }
  rt.obs.error(scope, "database unavailable", { reason });
}

async function executeRun<D extends ModelFieldsInput>(
  rt: Runtime,
  run: FlowRun<D>,
): Promise<Signal> {
  const metricRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
  const scope = obsScope(metricRt);
  const spanName = `${run.model.name.toLowerCase()}.${run.operation}`;
  return await rt.obs.runSpan(scope, spanName, {}, async (span) => {
    const dbOk = await rt.awaitDb();
    if (dbOk === false) {
      reportDatabaseFailure(metricRt);
      span.setAttribute("signal", Failed);
      span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
      return Failed;
    }
    rt.clearDbError();
    const startedAt = Date.now();
    rt.obs.count(scope, "operation.started");
    let signal: Signal = Failed;

    if (run.operation === "list") {
      if (run.filter.length < 1) {
        rt.obs.measure(scope, "operation.duration", Date.now() - startedAt);
        rt.obs.count(scope, "operation.failed");
        span.setAttribute("signal", Failed);
        span.setStatus({ code: SpanStatusCode.ERROR, message: "invalid filter" });
        return Failed;
      }
      const listFilterInput = firstPresent(run.filter, "list filter required");
      const validatedHits = catchValidation(() => run.model.validateListFilter(listFilterInput));
      if (validatedHits.length < 1) {
        rt.obs.measure(scope, "operation.duration", Date.now() - startedAt);
        rt.obs.count(scope, "operation.failed");
        span.setAttribute("signal", Failed);
        span.setStatus({ code: SpanStatusCode.ERROR, message: "invalid filter" });
        return Failed;
      }
      const validated = firstPresent(validatedHits, "list filter required");
      const localRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
      const obs = createObservability(localRt);
      const filterState = copyFilterState(validated);
      const ops = createFlowModelOps(localRt, run.model, run.entityId, obs);
      const flow = listFlowOf<EntityFieldsOf<D>>(createFilter(run.model.fields, filterState), ops);
      signal = await run.model.flow.list(flow);
      if (signal === Failed) {
        rt.obs.measure(scope, "operation.duration", Date.now() - startedAt);
        rt.obs.count(scope, "operation.failed");
        span.setAttribute("signal", Failed);
        span.setStatus({ code: SpanStatusCode.ERROR, message: "flow failed" });
        return Failed;
      }
      if (signal === Done) {
        try {
          const rows = await rt.store.queryEntities(run.model, filterState);
          run.results = rows;
        } catch (err) {
          rt.obs.measure(scope, "operation.duration", Date.now() - startedAt);
          span.setAttribute("signal", Failed);
          if (err instanceof DatabaseError || err instanceof PgEncodeError) {
            reportDatabaseFailure(metricRt);
            span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
          } else if (err instanceof ModelFieldError) {
            rt.obs.count(scope, "operation.failed");
            span.setStatus({ code: SpanStatusCode.ERROR, message: "invalid filter" });
          } else {
            rt.obs.count(scope, "operation.failed");
            span.setStatus({ code: SpanStatusCode.ERROR, message: "invalid filter" });
          }
          return Failed;
        }
      }
    } else {
      signal = await withWriteTransaction(rt, (txRt) => executeRunMutation(txRt, run));
    }

    rt.obs.measure(scope, "operation.duration", Date.now() - startedAt);
    span.setAttribute("signal", signal);
    if (signal === Done) {
      rt.obs.count(scope, "operation.completed");
    } else if (signal === Failed) {
      rt.obs.count(scope, "operation.failed");
      span.setStatus({ code: SpanStatusCode.ERROR, message: "flow failed" });
    } else {
      rt.obs.count(scope, "operation.suspended");
      rt.obs.info(scope, "flow.suspended", { runId: run.id });
    }
    return signal;
  });
}

function resolveModelByName(
  models: ReadonlyArray<ModelDef<ModelFieldsInput>>,
  name: string,
): ModelDef<ModelFieldsInput>[] {
  const lowered = name.toLowerCase();
  for (const model of models) {
    if (model.name.toLowerCase() === lowered) {
      return [model];
    }
  }
  return [];
}

type HttpPayload = JsonObject;

function readJsonBody(req: http.IncomingMessage): Promise<readonly HttpPayload[]> {
  return new Promise((resolve) => {
    let chunks: readonly Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      if (Buffer.isBuffer(chunk) === false) {
        return;
      }
      if (chunk.length < 1) {
        return;
      }
      chunks = appendItem(chunks, chunk);
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks.slice()).toString("utf8"));
        if (isJsonObject(parsed) === true) {
          resolve([parsed]);
          return;
        }
        resolve([]);
      } catch {
        resolve([]);
      }
    });
    req.on("error", () => resolve([]));
  });
}

function requireHttpPayload(hits: readonly HttpPayload[], message: string): HttpPayload {
  if (Array.isArray(hits) === false) {
    throw ValidationError.create("http payload hits required");
  }
  for (const hit of hits) {
    if (z.string().min(1).safeParse(message).success === false) {
      throw ValidationError.create("http payload message required");
    }
    return hit;
  }
  throw ValidationError.create(message);
}

type HttpJsonFieldKinds = {
  text: string;
  number: number;
  boolean: boolean;
  entity: EntityRecord;
  entities: EntityRecord[];
  signal: Signal;
};

type HttpJsonField = HttpJsonFieldKinds[keyof HttpJsonFieldKinds];

function sendJson(
  res: http.ServerResponse,
  status: number,
  payload: Record<string, HttpJsonField>,
) {
  if (Number.isInteger(status) === false || status < 100 || status > 599) {
    throw ValidationError.create("http status required");
  }
  if (z.looseObject({}).safeParse(payload).success === false) {
    throw ValidationError.create("http payload required");
  }
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function listenPort(listen: string): readonly number[] {
  if (listen.length < 1) {
    return [];
  }
  if (/^\d+$/.test(listen) === false) {
    return [];
  }
  const port = Number(listen);
  if (Number.isInteger(port) === false || port < 0 || port > 65535) {
    return [];
  }
  return [port];
}

function pathPartsFrom(pathname: string): string[] {
  let parts: readonly string[] = [];
  for (const part of pathname.split("/")) {
    if (part.length < 1) {
      continue;
    }
    try {
      const decoded = decodeURIComponent(part);
      if (decoded.length > 0) {
        parts = appendItem(parts, decoded);
      }
    } catch {
      return [];
    }
  }
  return parts.slice();
}

function pathPartAt(parts: readonly string[], index: number): readonly string[] {
  let current = 0;
  for (const part of parts) {
    if (current === index) {
      if (part.length === 0) {
        return [];
      }
      return [part];
    }
    current += 1;
  }
  return [];
}

function httpStatusForFookieError(err: CaughtFailure): number {
  if (err instanceof ValidationError || err instanceof ModelFieldError) {
    return 400;
  }
  if (err instanceof NotFoundError) {
    return 404;
  }
  return 500;
}

function httpErrorPayload(err: CaughtFailure): { error: string } {
  if (err instanceof FookieError) {
    if (err.message.length < 1) {
      return { error: "internal error" };
    }
    return { error: err.message };
  }
  return { error: "internal error" };
}

function recordFromPayload(payload: HttpPayload, key: string): JsonObject[] {
  if (z.string().min(1).safeParse(key).success === false) {
    throw ValidationError.create("payload key required");
  }
  for (const [entryKey, entryValue] of Object.entries(payload)) {
    if (entryKey === key && isJsonObject(entryValue)) {
      return [entryValue];
    }
  }
  return [];
}

function payloadHasKey(payload: HttpPayload, key: string): boolean {
  if (z.string().min(1).safeParse(key).success === false) {
    throw ValidationError.create("payload key required");
  }
  for (const [entryKey] of Object.entries(payload)) {
    if (entryKey === key) {
      return true;
    }
  }
  return false;
}

type FilterPayloadKindKinds = {
  list: "list";
  update: "update";
  delete: "delete";
};

type FilterPayloadKind = FilterPayloadKindKinds[keyof FilterPayloadKindKinds];

function filterFromPayload(
  model: ModelDef<ModelFieldsInput>,
  payload: HttpPayload,
  kind: FilterPayloadKind,
): readonly FilterInput[] {
  const rawHits = recordFromPayload(payload, "filter");
  let filterValueHits: JsonValue[] = [];
  if (rawHits.length < 1) {
    if (payloadHasKey(payload, "filter") === true) {
      return [];
    }
    filterValueHits = [emptyFilterInput()];
  } else {
    for (const hit of rawHits) {
      filterValueHits = [hit];
      break;
    }
  }
  let filterValue: JsonValue = emptyFilterInput();
  for (const hit of filterValueHits) {
    filterValue = hit;
  }
  let validatedHits: FilterInput[];
  if (kind === "list") {
    validatedHits = catchValidation(() => model.validateListFilter(filterValue));
  } else if (kind === "update") {
    validatedHits = catchValidation(() => model.validateUpdateFilter(filterValue));
  } else {
    validatedHits = catchValidation(() => model.validateDeleteFilter(filterValue));
  }
  if (validatedHits.length < 1) {
    return [];
  }
  return validatedHits;
}

function requireFilterInput(hits: readonly FilterInput[], message: string): FilterInput {
  if (Array.isArray(hits) === false) {
    throw ValidationError.create("filter hits required");
  }
  for (const hit of hits) {
    if (z.string().min(1).safeParse(message).success === false) {
      throw ValidationError.create("filter message required");
    }
    return hit;
  }
  throw ValidationError.create(message);
}

function outboxPendingEntry(
  externalId: string,
  name: string,
  input: EntityRecord,
  entityId: string,
  model: string,
  runId: string,
  attempt: number,
): OutboxEntry {
  return {
    externalId,
    name,
    entityId,
    model,
    runId,
    input,
    attempt,
    status: "pending",
  };
}

function outboxPending(outboxRow: OutboxEntry, attempt: number): OutboxEntry {
  return outboxPendingEntry(
    outboxRow.externalId,
    outboxRow.name,
    outboxRow.input,
    outboxRow.entityId,
    outboxRow.model,
    outboxRow.runId,
    attempt,
  );
}

function outboxFailed(outboxRow: OutboxEntry): OutboxEntry {
  return {
    externalId: outboxRow.externalId,
    name: outboxRow.name,
    entityId: outboxRow.entityId,
    model: outboxRow.model,
    runId: outboxRow.runId,
    input: outboxRow.input,
    attempt: outboxRow.attempt,
    status: "failed",
  };
}

function outboxCompleted(outboxRow: OutboxEntry, output: EntityRecord): OutboxEntry {
  return {
    externalId: outboxRow.externalId,
    name: outboxRow.name,
    entityId: outboxRow.entityId,
    model: outboxRow.model,
    runId: outboxRow.runId,
    input: outboxRow.input,
    attempt: outboxRow.attempt,
    status: "completed",
    output,
  };
}

export function models(items: readonly ModelDef<ModelFieldsInput>[]): ModelDef<ModelFieldsInput>[] {
  let registered: readonly ModelDef<ModelFieldsInput>[] = [];
  for (const modelDef of items) {
    if (z.string().min(1).safeParse(modelDef.name).success === false) {
      throw ModelFieldError.create("model name required");
    }
    registered = appendItem(registered, modelDef);
  }
  return registered.slice();
}

type RegisteredModel = ModelDef<ModelFieldsInput>;

export type AppConfig<E extends readonly ExternalDef[] = readonly ExternalDef[]> = {
  listen: string;
  database: string;
  models: readonly RegisteredModel[];
  externals: E;
  onExternalEvent: (event: ExternalEventOf<E[number]>) => Promise<void>;
  pool: readonly InjectablePool[];
};

export class App<E extends readonly ExternalDef[] = readonly ExternalDef[]> {
  private readonly listen: string;
  private readonly registeredModels: readonly RegisteredModel[];
  private readonly externals: E;
  private readonly onExternalEvent: (event: ExternalEventOf<E[number]>) => Promise<void>;
  private readonly pool: InjectablePool;
  private readonly ownsPool: boolean;
  private readonly store: PostgresStore;
  private readonly runs = new Map<string, FlowRun<ModelFieldsInput>>();
  private readonly outbox = new Map<string, OutboxEntry>();
  private readonly entities = new Map<string, EntityRecord>();
  private readonly obs = new Observability();
  private readonly listResultsBox: { rows: EntityRecord[] } = { rows: [] };
  private readonly pendingExternalEvents: PendingEventQueue = { events: [] };
  private readonly pendingEntityWrites: PendingWriteQueue = { rows: [] };
  private readonly dbReadyBox: { ready: boolean } = { ready: false };
  private readonly dbErrorBox: { messages: readonly string[] } = { messages: [] };
  private readonly serverBox: { servers: readonly http.Server[] } = { servers: [] };

  private constructor(config: AppConfig<E>) {
    this.listen = config.listen;
    this.registeredModels = config.models;
    this.externals = config.externals;
    this.onExternalEvent = config.onExternalEvent;
    if (config.pool.length > 0) {
      this.ownsPool = false;
      this.pool = requireInjectedPool(config.pool);
    } else {
      this.ownsPool = true;
      this.pool = wrapOwnedPool(config.database);
    }
    this.store = PostgresStore.create(this.pool, [
      (message) => {
        if (z.string().safeParse(message).success === false) {
          this.dbErrorBox.messages = [];
          return;
        }
        if (message.length < 1) {
          this.dbErrorBox.messages = [];
          return;
        }
        this.dbErrorBox.messages = [message];
      },
    ]);
  }

  static create<const E extends readonly ExternalDef[]>(config: AppConfig<E>): App<E> {
    if (z.string().safeParse(config.listen).success === false) {
      throw ValidationError.create("app listen required");
    }
    if (z.string().safeParse(config.database).success === false) {
      throw ValidationError.create("app database required");
    }
    if (config.models.length < 1) {
      throw ValidationError.create("app models required");
    }
    return new App(config);
  }

  private reportAppError(
    operation: string,
    message: string,
    fields: Record<string, LogFieldValue>,
  ): void {
    const errorId = uuidV7();
    this.obs.error(
      {
        traceId: errorId,
        model: "app",
        entityId: errorId,
        operation,
      },
      message,
      fields,
    );
  }

  async stop(): Promise<boolean> {
    let ok = true;
    if (this.serverBox.servers.length > 0) {
      const server = firstPresent(this.serverBox.servers, "http server required");
      try {
        await new Promise<void>((resolve, reject) => {
          server.close((err) => {
            if (err instanceof Error) {
              reject(err);
              return;
            }
            if (z.instanceof(Error).safeParse(err).success === true) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      } catch (err) {
        this.reportAppError("stop", "server stop failed", {
          reason: dbErrorMessageForLog(err, "database unavailable"),
        });
        ok = false;
      }
      this.serverBox.servers = [];
    }
    if (this.ownsPool) {
      for (const closePool of this.pool.end) {
        try {
          await closePool();
        } catch (err) {
          this.reportAppError("stop", "pool stop failed", {
            reason: dbErrorMessageForLog(err, "database unavailable"),
          });
          ok = false;
        }
      }
    }
    return ok;
  }

  private finalizeRun(runId: string, run: FlowRun<ModelFieldsInput>, signal: Signal): void {
    run.signal = signal;
    if (signal === Failed) {
      this.runs.delete(runId);
    }
    if (this.runs.size <= runBufferLimit) {
      return;
    }
    for (const [id, entry] of this.runs) {
      if (id !== runId && entry.signal !== Running) {
        this.runs.delete(id);
        if (this.runs.size <= runBufferLimit) {
          return;
        }
      }
    }
  }

  run(): boolean {
    if (this.serverBox.servers.length > 0) {
      return true;
    }
    const portHits = listenPort(this.listen);
    if (portHits.length < 1) {
      return false;
    }
    const port = firstPresent(portHits, "listen port required");
    const server = http.createServer((req, res) => {
      this.handleHttp(req, res).catch((err) => {
        const status = httpStatusForFookieError(err);
        if (
          status === 500 &&
          !(
            err instanceof DatabaseError ||
            err instanceof PgEncodeError ||
            err instanceof ValidationError ||
            err instanceof ModelFieldError ||
            err instanceof NotFoundError
          )
        ) {
          this.reportAppError("handleHttp", "internal error", {
            reason: dbErrorMessageForLog(err, "internal error"),
          });
        } else if (status === 500) {
          this.reportAppError("handleHttp", "internal error", {
            reason: dbErrorMessageForLog(err, "database unavailable"),
          });
        }
        if (res.headersSent === false) {
          sendJson(res, status, httpErrorPayload(err));
        }
      });
    });
    server.once("error", (err) => {
      const reason = dbErrorMessageForLog(err, "database unavailable");
      this.reportAppError("listen", "server listen failed", {
        reason,
      });
      if (this.serverBox.servers.length > 0 && this.serverBox.servers[0] === server) {
        this.serverBox.servers = [];
      }
    });
    server.listen(port);
    this.serverBox.servers = [server];
    return true;
  }

  create<D extends ModelFieldsInput>(
    model: ModelDef<D>,
    body: InferCreateBody<D>,
  ): Promise<CreateResult<ModelEntity<D>>> {
    const runId = uuidV7();
    const entityId = uuidV7();
    const run: FlowRun<D> = {
      id: runId,
      model,
      operation: "create",
      entityId,
      body: [entityRecordFromPlain(body)],
      filter: [],
      entity: [],
      created: [],
      results: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    return executeRun(this.runtimeFor(runId, model, entityId, "create"), run).then(
      (signal): CreateResult<ModelEntity<D>> => {
        this.finalizeRun(runId, run, signal);
        if (signal === Done) {
          for (const created of run.created) {
            if (isModelEntity(model, created) === false) {
              return { signal: Failed };
            }
            return {
              signal: Done,
              id: entityId,
              entity: created,
            };
          }
        }
        if (signal === Running) {
          return { signal: Running, runId };
        }
        return { signal: Failed };
      },
    );
  }

  list<D extends ModelFieldsInput>(model: ModelDef<D>, filter: FilterInput): Promise<Signal> {
    const runId = uuidV7();
    const run: FlowRun<D> = {
      id: runId,
      model,
      operation: "list",
      entityId: runId,
      body: [],
      filter: [filter],
      entity: [],
      created: [],
      results: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    return executeRun(this.runtimeFor(runId, model, runId, "list"), run).then((signal) => {
      if (z.string().min(1).safeParse(runId).success === false) {
        throw ValidationError.create("list run id required");
      }
      if (Array.isArray(run.results) === false) {
        throw ValidationError.create("list results required");
      }
      this.finalizeRun(runId, run, signal);
      this.publishListResults(signal, run.results);
      return signal;
    });
  }

  update<D extends ModelFieldsInput>(
    model: ModelDef<D>,
    input: { id: string; body: UpdateBody<EntityFieldsOf<D>>; filter: FilterInput },
  ): Promise<Signal> {
    const runId = uuidV7();
    const run: FlowRun<D> = {
      id: runId,
      model,
      operation: "update",
      entityId: input.id,
      body: [entityRecordFromUpdateBody(input.body)],
      filter: [input.filter],
      entity: [],
      created: [],
      results: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    return executeRun(this.runtimeFor(runId, model, input.id, "update"), run).then((signal) => {
      if (z.string().min(1).safeParse(runId).success === false) {
        throw ValidationError.create("update run id required");
      }
      if (z.string().min(1).safeParse(input.id).success === false) {
        throw ValidationError.create("update entity id required");
      }
      this.finalizeRun(runId, run, signal);
      return signal;
    });
  }

  delete<D extends ModelFieldsInput>(
    model: ModelDef<D>,
    input: { id: string; filter: FilterInput },
  ): Promise<Signal> {
    const runId = uuidV7();
    const run: FlowRun<D> = {
      id: runId,
      model,
      operation: "delete",
      entityId: input.id,
      body: [],
      filter: [input.filter],
      entity: [],
      created: [],
      results: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    return executeRun(this.runtimeFor(runId, model, input.id, "delete"), run).then((signal) => {
      if (z.string().min(1).safeParse(runId).success === false) {
        throw ValidationError.create("delete run id required");
      }
      if (z.string().min(1).safeParse(input.id).success === false) {
        throw ValidationError.create("delete entity id required");
      }
      this.finalizeRun(runId, run, signal);
      return signal;
    });
  }

  resume(runId: string): Promise<Signal> {
    const runHits = mapLookup(this.runs, runId);
    if (runHits.length < 1) {
      return Promise.resolve(Failed);
    }
    const run = firstPresent(runHits, "run required");
    if (run.signal !== Running) {
      return Promise.resolve(run.signal);
    }
    return executeRun(this.runtimeFor(runId, run.model, run.entityId, run.operation), run).then(
      (signal) => {
        if (z.string().min(1).safeParse(runId).success === false) {
          throw ValidationError.create("resume run id required");
        }
        if (run.signal !== Running && run.signal !== Done && run.signal !== Failed) {
          throw ValidationError.create("resume signal invalid");
        }
        this.finalizeRun(runId, run, signal);
        return signal;
      },
    );
  }

  async setExternalResult(externalResult: { externalId: string; output: JsonValue }): Promise<boolean> {
    const outboxHits = mapLookup(this.outbox, externalResult.externalId);
    if (outboxHits.length < 1) {
      return false;
    }
    {
      const outboxRow = firstPresent(outboxHits, "outbox entry required");
      if (outboxRow.status === "completed") {
        return true;
      }
      if (outboxRow.status === "failed") {
        return false;
      }
      const runs = mapLookup(this.runs, outboxRow.runId);
      const resolvedModels = resolveModelByName(this.registeredModels, outboxRow.model);
      let scopeModel = outboxRow.model;
      for (const hit of resolvedModels) {
        scopeModel = hit.name;
      }
      if (resolvedModels.length < 1) {
        for (const run of runs) {
          scopeModel = run.model.name;
        }
      }
      let scopeOperation = "external";
      for (const run of runs) {
        scopeOperation = run.operation;
      }
      const scope: ObsScope = {
        traceId: outboxRow.runId,
        model: scopeModel,
        entityId: outboxRow.entityId,
        operation: scopeOperation,
      };
      const extHits = resolveExternalByName(this.externals, outboxRow.name);
      if (extHits.length < 1) {
        this.obs.error(scope, "external.result_rejected", {
          reason: "unknown external",
          name: outboxRow.name,
          externalId: outboxRow.externalId,
        });
        this.obs.count(scope, "external.failed");
        this.obs.info(scope, "external.failed", {
          externalId: outboxRow.externalId,
          attempt: outboxRow.attempt,
        });
        const unknownFailed = await this.recordOutbox(outboxFailed(outboxRow));
        if (unknownFailed === false) {
          return false;
        }
        let unknownResumeModel: readonly ModelDef<ModelFieldsInput>[] = [];
        for (const resolvedModel of resolvedModels) {
          unknownResumeModel = [resolvedModel];
        }
        for (const runningRun of runs) {
          unknownResumeModel = [runningRun.model];
        }
        if (unknownResumeModel.length < 1) {
          return false;
        }
        this.obs.info(scope, "flow.resumed", { runId: outboxRow.runId });
        const unknownResumed = await this.resume(outboxRow.runId);
        if (unknownResumed === Failed) {
          this.obs.error(scope, "flow.resume_failed", { runId: outboxRow.runId });
        }
        return false;
      }
      const ext = firstPresent(extHits, "external required");
      const spanAttributes = { externalName: outboxRow.name, externalId: outboxRow.externalId };
      return this.obs.runSpan(scope, "external.result", spanAttributes, async (span) => {
        const validatedHits = catchValidation(() => ext.validateOutput(externalResult.output));
        if (validatedHits.length < 1) {
          if (outboxRow.attempt < ext.attempts) {
            const nextAttempt = outboxRow.attempt + 1;
            this.obs.count(scope, "external.retry");
            this.obs.info(scope, "external.retry", {
              externalId: outboxRow.externalId,
              attempt: nextAttempt,
            });
            const recorded = await this.recordOutbox(outboxPending(outboxRow, nextAttempt));
            if (recorded === false) {
              span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
              return false;
            }
            await sleep(backoffDelayMs(ext.backoff, nextAttempt));
            const emitted = await emitExternalHandler(
              this.onExternalEvent,
              ext,
              outboxRow.externalId,
              outboxRow.input,
            );
            if (emitted !== "emitted") {
              this.obs.error(scope, "external.emit_skipped", {
                reason: emitted === "handler_error" ? "handler error" : "invalid input",
                name: outboxRow.name,
                externalId: outboxRow.externalId,
              });
              const skippedFailed = await this.recordOutbox(
                outboxFailed(outboxPending(outboxRow, nextAttempt)),
              );
              if (skippedFailed === false) {
                span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
                return false;
              }
              this.obs.count(scope, "external.failed");
              this.obs.info(scope, "external.failed", {
                externalId: outboxRow.externalId,
                attempt: nextAttempt,
              });
              let skipResumeModel: readonly ModelDef<ModelFieldsInput>[] = [];
              for (const resolvedModel of resolvedModels) {
                skipResumeModel = [resolvedModel];
              }
              for (const runningRun of runs) {
                skipResumeModel = [runningRun.model];
              }
              if (skipResumeModel.length < 1) {
                return false;
              }
              this.obs.info(scope, "flow.resumed", { runId: outboxRow.runId });
              const skipResumed = await this.resume(outboxRow.runId);
              if (skipResumed === Failed) {
                this.obs.error(scope, "flow.resume_failed", { runId: outboxRow.runId });
              }
              return false;
            }
            return false;
          }
          this.obs.count(scope, "external.failed");
          this.obs.info(scope, "external.failed", {
            externalId: outboxRow.externalId,
            attempt: outboxRow.attempt,
          });
          span.setStatus({ code: SpanStatusCode.ERROR, message: "external output invalid" });
          const failedRecorded = await this.recordOutbox(outboxFailed(outboxRow));
          if (failedRecorded === false) {
            span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
            return false;
          }
          let failResumeModel: readonly ModelDef<ModelFieldsInput>[] = [];
          for (const resolvedModel of resolvedModels) {
            failResumeModel = [resolvedModel];
          }
          for (const runningRun of runs) {
            failResumeModel = [runningRun.model];
          }
          if (failResumeModel.length < 1) {
            return false;
          }
          this.obs.info(scope, "flow.resumed", { runId: outboxRow.runId });
          const failResumed = await this.resume(outboxRow.runId);
          if (failResumed === Failed) {
            this.obs.error(scope, "flow.resume_failed", { runId: outboxRow.runId });
          }
          return false;
        }
        const validated = firstPresent(validatedHits, "validated body required");
        this.obs.count(scope, "external.completed");
        this.obs.info(scope, "external.completed", { externalId: outboxRow.externalId });
        const completedRecorded = await this.recordOutbox(outboxCompleted(outboxRow, validated));
        if (completedRecorded === false) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
          return false;
        }
        let resumeModel: readonly ModelDef<ModelFieldsInput>[] = [];
        for (const resolvedModel of resolvedModels) {
          resumeModel = [resolvedModel];
        }
        for (const runningRun of runs) {
          resumeModel = [runningRun.model];
        }
        if (resumeModel.length < 1) {
          return true;
        }
        this.obs.info(scope, "flow.resumed", { runId: outboxRow.runId });
        const resumed = await this.resume(outboxRow.runId);
        if (resumed === Failed) {
          this.obs.error(scope, "flow.resume_failed", { runId: outboxRow.runId });
        }
        return true;
      });
    }
  }

  async patchOutbox(externalId: string, output: EntityRecord): Promise<boolean> {
    const outboxHits = mapLookup(this.outbox, externalId);
    if (outboxHits.length < 1) {
      return false;
    }
    const outboxEntry = firstPresent(outboxHits, "outbox entry required");
    if (outboxEntry.status === "completed") {
      return true;
    }
    if (outboxEntry.status === "failed") {
      return false;
    }
    const extHits = resolveExternalByName(this.externals, outboxEntry.name);
    if (extHits.length < 1) {
      return false;
    }
    const ext = firstPresent(extHits, "external required");
    const validatedHits = catchValidation(() => ext.validateOutput(output));
    if (validatedHits.length < 1) {
      return false;
    }
    const validated = firstPresent(validatedHits, "validated body required");
    return await this.recordOutbox(outboxCompleted(outboxEntry, validated));
  }

  logs(): LogEntry[] {
    if (Array.isArray(this.obs.buffers.logs) === false) {
      throw ValidationError.create("log buffer required");
    }
    const copied = this.obs.buffers.logs.slice();
    if (Array.isArray(copied) === false) {
      throw ValidationError.create("log copy required");
    }
    return copied;
  }

  metrics(): MetricEntry[] {
    if (Array.isArray(this.obs.buffers.metrics) === false) {
      throw ValidationError.create("metric buffer required");
    }
    const copied = this.obs.buffers.metrics.slice();
    if (Array.isArray(copied) === false) {
      throw ValidationError.create("metric copy required");
    }
    return copied;
  }

  spans(): SpanEntry[] {
    if (Array.isArray(this.obs.buffers.spans) === false) {
      throw ValidationError.create("span buffer required");
    }
    const copied = this.obs.buffers.spans.slice();
    if (Array.isArray(copied) === false) {
      throw ValidationError.create("span copy required");
    }
    return copied;
  }

  listResults(): EntityRecord[] {
    if (Array.isArray(this.listResultsBox.rows) === false) {
      throw ValidationError.create("list results required");
    }
    const copied = this.listResultsBox.rows.slice();
    if (Array.isArray(copied) === false) {
      throw ValidationError.create("list results copy required");
    }
    return copied;
  }

  private publishListResults(signal: Signal, rows: readonly EntityRecord[]): void {
    if (Array.isArray(rows) === false) {
      throw ValidationError.create("list rows required");
    }
    if (signal === Done) {
      this.listResultsBox.rows = rows.slice();
      return;
    }
    if (signal === Failed) {
      this.listResultsBox.rows = [];
    }
  }

  private async recordOutbox(outboxRow: OutboxEntry): Promise<boolean> {
    const previous = mapLookup(this.outbox, outboxRow.externalId);
    this.outbox.set(outboxRow.externalId, outboxRow);
    const ok = await this.store.saveOutboxEntry(outboxRow);
    if (ok === false) {
      if (previous.length < 1) {
        this.outbox.delete(outboxRow.externalId);
      } else {
        for (const prior of previous) {
          this.outbox.set(outboxRow.externalId, prior);
        }
      }
      return false;
    }
    return true;
  }

  private runtimeFor(
    traceId: string,
    model: ModelDef<ModelFieldsInput>,
    entityId: string,
    operation: string,
  ): Runtime<E> {
    return {
      traceId,
      model,
      entityId,
      operation,
      obs: this.obs,
      outbox: this.outbox,
      onExternalEvent: this.onExternalEvent,
      models: this.registeredModels,
      externals: this.externals,
      entities: this.entities,
      pool: this.pool,
      store: this.store,
      listResults: this.listResultsBox.rows,
      pendingExternalEvents: this.pendingExternalEvents,
      pendingEntityWrites: this.pendingEntityWrites,
      reportDbError: (message: string) => {
        if (z.string().safeParse(message).success === false) {
          this.dbErrorBox.messages = [];
          return;
        }
        if (message.length < 1) {
          this.dbErrorBox.messages = [];
          return;
        }
        this.dbErrorBox.messages = [message];
      },
      clearDbError: () => {
        if (Array.isArray(this.dbErrorBox.messages) === false) {
          this.dbErrorBox.messages = [];
          return;
        }
        if (this.dbErrorBox.messages.length > 0) {
          this.dbErrorBox.messages = [];
        }
      },
      dbLastError: () => this.dbErrorBox.messages,
      awaitDb: () => this.awaitDb(),
      resume: (runId) => this.resume(runId),
    };
  }

  private async awaitDb(): Promise<boolean> {
    if (this.dbReadyBox.ready === true) {
      return true;
    }
    const errorBox: DbErrorBox = { message: "database unavailable" };
    const tablesOk = await this.store.ensureAllTables(this.registeredModels, errorBox);
    if (tablesOk === false) {
      this.dbErrorBox.messages = [dbErrorBoxText(errorBox)];
      return false;
    }
    const outboxOk = await this.store.loadOutbox(this.outbox, errorBox);
    if (outboxOk === false) {
      this.dbErrorBox.messages = [dbErrorBoxText(errorBox)];
      return false;
    }
    this.dbReadyBox.ready = true;
    return true;
  }

  private async handleHttp(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (req.headers["x-fookie-test-throw"] === "1") {
      throw new Error("test");
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }
    const payloadHits = await readJsonBody(req);
    if (payloadHits.length < 1) {
      sendJson(res, 400, { error: "invalid body" });
      return;
    }
    const payload = requireHttpPayload(payloadHits, "invalid body");
    const requestUrlParsed = z.string().safeParse(req.url);
    if (requestUrlParsed.success === false) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const url = new URL(requestUrlParsed.data, "http://local");
    const parts = pathPartsFrom(url.pathname);
    const routeHeadHits = pathPartAt(parts, 0);
    const routeNextHits = pathPartAt(parts, 1);
    if (routeHeadHits[0] === "external" && routeNextHits[0] === "result") {
      if (parts.length !== 2) {
        sendJson(res, 404, { error: "not found" });
        return;
      }
      const externalIdParsed = z.string().min(1).safeParse(payload.externalId);
      if (externalIdParsed.success === false) {
        sendJson(res, 400, { error: "invalid externalId" });
        return;
      }
      const outputHits = recordFromPayload(payload, "output");
      if (outputHits.length < 1) {
        sendJson(res, 400, { error: "invalid output" });
        return;
      }
      for (const output of outputHits) {
        const accepted = await this.setExternalResult({
          externalId: externalIdParsed.data,
          output,
        });
        if (accepted === true) {
          sendJson(res, 200, { signal: Done });
          return;
        }
        sendJson(res, 400, { error: "external result rejected" });
        return;
      }
      sendJson(res, 400, { error: "invalid output" });
      return;
    }
    if (parts.length < 2) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const modelNameHits = pathPartAt(parts, 0);
    const actionHits = pathPartAt(parts, 1);
    if (modelNameHits.length < 1 || actionHits.length < 1) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const modelName = firstPresent(modelNameHits, "model name required");
    const action = firstPresent(actionHits, "action required");
    const modelHits = resolveModelByName(this.registeredModels, modelName);
    if (modelHits.length < 1) {
      sendJson(res, 404, { error: "model not found" });
      return;
    }
    const model = firstPresent(modelHits, "model required");
    if (action === "create") {
      if (parts.length !== 2) {
        sendJson(res, 404, { error: "not found" });
        return;
      }
      const bodyHits = recordFromPayload(payload, "body");
      if (bodyHits.length < 1) {
        sendJson(res, 400, { error: "invalid body" });
        return;
      }
      const body = firstPresent(bodyHits, "http body required");
      const validatedHits = catchValidation(() => model.validateCreateBody(body));
      if (validatedHits.length < 1) {
        sendJson(res, 400, { error: "invalid body" });
        return;
      }
      const validated = firstPresent(validatedHits, "validated body required");
      const runId = uuidV7();
      const entityId = uuidV7();
      const run: FlowRun<ModelFieldsInput> = {
        id: runId,
        model,
        operation: "create",
        entityId,
        body: [validated],
        filter: [],
        entity: [],
        created: [],
        results: [],
        signal: Running,
      };
      this.runs.set(runId, run);
      const signal = await executeRun(this.runtimeFor(runId, model, entityId, "create"), run);
      this.finalizeRun(runId, run, signal);
      if (signal === Done) {
        for (const created of run.created) {
          sendJson(res, 200, { signal: Done, id: entityId, entity: created });
          return;
        }
      }
      if (signal === Running) {
        sendJson(res, 200, { signal: Running, runId });
        return;
      }
      sendJson(res, 200, { signal: Failed });
      return;
    }
    if (action === "list") {
      if (parts.length !== 2) {
        sendJson(res, 404, { error: "not found" });
        return;
      }
      const listFilterHits = filterFromPayload(model, payload, "list");
      if (listFilterHits.length < 1) {
        sendJson(res, 400, { error: "invalid filter" });
        return;
      }
      const filter = requireFilterInput(listFilterHits, "invalid filter");
      const runId = uuidV7();
      const run: FlowRun<ModelFieldsInput> = {
        id: runId,
        model,
        operation: "list",
        entityId: runId,
        body: [],
        filter: [filter],
        entity: [],
        created: [],
        results: [],
        signal: Running,
      };
      this.runs.set(runId, run);
      const signal = await executeRun(this.runtimeFor(runId, model, runId, "list"), run);
      this.finalizeRun(runId, run, signal);
      this.publishListResults(signal, run.results);
      sendJson(res, 200, { signal, results: run.results });
      return;
    }
    if (parts.length !== 3) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const entityIdHits = pathPartAt(parts, 1);
    const mutationHits = pathPartAt(parts, 2);
    if (entityIdHits.length < 1 || mutationHits.length < 1) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const entityId = firstPresent(entityIdHits, "entity id required");
    const mutation = firstPresent(mutationHits, "mutation required");
    if (mutation !== "update" && mutation !== "delete") {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    if (uuidSchema.safeParse(entityId).success === false) {
      sendJson(res, 400, { error: "invalid id" });
      return;
    }
    if (mutation === "update") {
      const updateFilterHits = filterFromPayload(model, payload, "update");
      if (updateFilterHits.length < 1) {
        sendJson(res, 400, { error: "invalid filter" });
        return;
      }
      const filter = requireFilterInput(updateFilterHits, "invalid filter");
      const bodyHits = recordFromPayload(payload, "body");
      if (bodyHits.length < 1) {
        sendJson(res, 400, { error: "invalid body" });
        return;
      }
      const updateBody = firstPresent(bodyHits, "http update body required");
      const bodyValidHits = catchValidation(() => model.validateUpdateBody(updateBody));
      if (bodyValidHits.length < 1) {
        sendJson(res, 400, { error: "invalid body" });
        return;
      }
      const bodyValid = firstPresent(bodyValidHits, "update body required");
      const runId = uuidV7();
      const run: FlowRun<ModelFieldsInput> = {
        id: runId,
        model,
        operation: "update",
        entityId,
        body: [bodyValid],
        filter: [filter],
        entity: [],
        created: [],
        results: [],
        signal: Running,
      };
      this.runs.set(runId, run);
      const signal = await executeRun(this.runtimeFor(runId, model, entityId, "update"), run);
      this.finalizeRun(runId, run, signal);
      sendJson(res, 200, { signal });
      return;
    }
    if (mutation === "delete") {
      const deleteFilterHits = filterFromPayload(model, payload, "delete");
      if (deleteFilterHits.length < 1) {
        sendJson(res, 400, { error: "invalid filter" });
        return;
      }
      const filter = requireFilterInput(deleteFilterHits, "invalid filter");
      const runId = uuidV7();
      const run: FlowRun<ModelFieldsInput> = {
        id: runId,
        model,
        operation: "delete",
        entityId,
        body: [],
        filter: [filter],
        entity: [],
        created: [],
        results: [],
        signal: Running,
      };
      this.runs.set(runId, run);
      const signal = await executeRun(this.runtimeFor(runId, model, entityId, "delete"), run);
      this.finalizeRun(runId, run, signal);
      sendJson(res, 200, { signal });
    }
  }
}

export type AppInstance = App;

export function app<const E extends readonly ExternalDef[]>(config: AppConfig<E>): App<E> {
  if (z.looseObject({}).safeParse(config).success === false) {
    throw ValidationError.create("app config required");
  }
  if (Array.isArray(config.models) === false) {
    throw ValidationError.create("app models required");
  }
  if (config.models.length < 1) {
    throw ValidationError.create("app models required");
  }
  return App.create(config);
}
