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
export type Signal = DoneSignal | RunningSignal | FailedSignal;

export type Coordinate = readonly [number, number];

export type EntityValue = string | number | boolean | Coordinate;

export type EntityRecord = Record<string, EntityValue>;

export type JsonValue =
  string | number | boolean | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type JsonObject = { readonly [key: string]: JsonValue };

export type FilterGroup =
  | "numeric"
  | "bigint"
  | "decimal"
  | "string"
  | "uuid"
  | "boolean"
  | "temporal"
  | "coordinate"
  | "json"
  | "geometric"
  | "binary";

type TypeMeta = {
  unique: boolean;
  index: boolean;
  min: number;
  max: number;
};

type Scalar = EntityValue;

type ScalarSchema = z.ZodType<Scalar, Scalar>;

const defaultMeta = (): TypeMeta => ({
  unique: false,
  index: false,
  min: -1,
  max: -1,
});

export class PlainType<T extends Scalar, G extends FilterGroup> {
  readonly schema: ScalarSchema & z.ZodType<T, T>;
  readonly kind: string;
  readonly filterGroup: G;
  readonly meta: TypeMeta;

  constructor(
    schema: z.ZodType<T, T>,
    kind: string,
    filterGroup: G,
    meta: TypeMeta = defaultMeta(),
  ) {
    this.schema = schema;
    this.kind = kind;
    this.filterGroup = filterGroup;
    this.meta = meta;
  }

  unique(): PlainType<T, G> {
    return new PlainType(this.schema, this.kind, this.filterGroup, { ...this.meta, unique: true });
  }

  index(): PlainType<T, G> {
    return new PlainType(this.schema, this.kind, this.filterGroup, { ...this.meta, index: true });
  }
}

export class NumericType {
  readonly filterGroup = "numeric" as const;
  readonly schema: z.ZodNumber;
  readonly kind: string;
  readonly meta: TypeMeta;

  constructor(schema: z.ZodNumber, kind: string, meta: TypeMeta = defaultMeta()) {
    this.schema = schema;
    this.kind = kind;
    this.meta = meta;
  }

  unique(): NumericType {
    return new NumericType(this.schema, this.kind, { ...this.meta, unique: true });
  }

  index(): NumericType {
    return new NumericType(this.schema, this.kind, { ...this.meta, index: true });
  }

  min(n: number): NumericType {
    return new NumericType(this.schema.min(n), this.kind, { ...this.meta, min: n });
  }

  max(n: number): NumericType {
    return new NumericType(this.schema.max(n), this.kind, { ...this.meta, max: n });
  }
}

export type NumericTypeDef = NumericType;
type PlainTypeDef<T extends Scalar, G extends FilterGroup> = PlainType<T, G>;
type CoordinateTypeDef = PlainType<Coordinate, "coordinate">;

export type ScalarTypeDef =
  NumericType | PlainType<string, FilterGroup> | PlainType<boolean, "boolean"> | CoordinateTypeDef;

export type TypeDef<T extends Scalar = Scalar> = T extends number
  ? NumericType
  : T extends Coordinate
    ? CoordinateTypeDef
    : T extends boolean
      ? PlainType<boolean, "boolean">
      : PlainType<string, FilterGroup>;

const coordinateSchema: z.ZodType<Coordinate, Coordinate> = z.tuple([z.number(), z.number()]);

const uuidSchema = z.string().uuid();
const bigintSchema = z.string().regex(/^-?\d+$/);
const decimalSchema = z.string().regex(/^-?\d+(\.\d+)?$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}:\d{2}(\.\d+)?$/);
const timetzSchema = z.string().regex(/^\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}(:\d{2})?|Z)$/);
const intervalSchema = z
  .string()
  .regex(
    /^-?\d+ (years?|mons?|days?|hours?|mins?|secs?)( -?\d+ (years?|mons?|days?|hours?|mins?|secs?))*$/,
  );
const inetSchema = z
  .string()
  .regex(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$|^([0-9a-fA-F:]+)(\/\d{1,3})?$/);
const cidrSchema = z.string().regex(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$|^([0-9a-fA-F:]+)\/\d{1,3}$/);
const macaddrSchema = z.string().regex(/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/);
const byteaSchema = z.string().regex(/^(\\x)?[0-9a-fA-F]*$/);
const geometricSchema = z.string().min(1);
const jsonSchema = z.string().refine((v) => {
  try {
    JSON.parse(v);
    return true;
  } catch {
    return false;
  }
});

export const Types = {
  smallint: new NumericType(z.number().int().min(-32768).max(32767), "smallint"),
  integer: new NumericType(z.number().int(), "integer"),
  int: new NumericType(z.number().int(), "integer"),
  bigint: new PlainType(bigintSchema, "bigint", "bigint"),
  numeric: new PlainType(decimalSchema, "numeric", "decimal"),
  real: new NumericType(z.number(), "real"),
  float: new NumericType(z.number(), "real"),
  doublePrecision: new NumericType(z.number(), "doublePrecision"),
  serial: new NumericType(z.number().int().positive(), "serial"),
  bigserial: new PlainType(bigintSchema, "bigserial", "bigint"),
  text: new PlainType(z.string(), "text", "string"),
  string: new PlainType(z.string(), "text", "string"),
  varchar: (length: number) =>
    new PlainType(z.string().max(length), `varchar(${length})`, "string"),
  char: (length: number) => new PlainType(z.string().length(length), `char(${length})`, "string"),
  boolean: new PlainType(z.boolean(), "boolean", "boolean"),
  bool: new PlainType(z.boolean(), "boolean", "boolean"),
  uuid: new PlainType(uuidSchema, "uuid", "uuid"),
  id: new PlainType(uuidSchema, "id", "uuid"),
  date: new PlainType(dateSchema, "date", "temporal"),
  time: new PlainType(timeSchema, "time", "temporal"),
  timetz: new PlainType(timetzSchema, "timetz", "temporal"),
  timestamp: new PlainType(z.iso.datetime(), "timestamp", "temporal"),
  timestamptz: new PlainType(z.iso.datetime(), "timestamptz", "temporal"),
  datetime: new PlainType(z.iso.datetime(), "timestamp", "temporal"),
  interval: new PlainType(intervalSchema, "interval", "temporal"),
  json: new PlainType(jsonSchema, "json", "json"),
  jsonb: new PlainType(jsonSchema, "jsonb", "json"),
  bytea: new PlainType(byteaSchema, "bytea", "binary"),
  inet: new PlainType(inetSchema, "inet", "string"),
  cidr: new PlainType(cidrSchema, "cidr", "string"),
  macaddr: new PlainType(macaddrSchema, "macaddr", "string"),
  money: new NumericType(z.number(), "money"),
  currency: new NumericType(z.number().nonnegative(), "currency"),
  point: new PlainType(coordinateSchema, "point", "coordinate"),
  coordinate: new PlainType(coordinateSchema, "point", "coordinate"),
  line: new PlainType(geometricSchema, "line", "geometric"),
  lseg: new PlainType(geometricSchema, "lseg", "geometric"),
  box: new PlainType(geometricSchema, "box", "geometric"),
  path: new PlainType(geometricSchema, "path", "geometric"),
  polygon: new PlainType(geometricSchema, "polygon", "geometric"),
  circle: new PlainType(geometricSchema, "circle", "geometric"),
  xml: new PlainType(z.string(), "xml", "string"),
  email: new PlainType(z.string().email(), "email", "string"),
  url: new PlainType(z.string().url(), "url", "string"),
  enum<T extends readonly [string, ...string[]]>(...values: T): PlainType<string, "string"> {
    return new PlainType<string, "string">(z.enum(values), "enum", "string");
  },
  relation<T extends { name: string }>(model: T): PlainType<string, "uuid"> {
    return new PlainType(uuidSchema, `relation:${model.name}`, "uuid");
  },
};

export type ModelRef = {
  name: string;
};

export type FieldsMap = {
  [key: string]: ScalarTypeDef | ModelRef | ModelDef<ModelFieldsInput>;
};

type FieldValue = ScalarTypeDef | ModelRef | ModelDef<ModelFieldsInput>;

function isModelRef(value: FieldValue): value is ModelRef {
  return "name" in value && !("schema" in value) && !("flow" in value);
}

function isRelationField(value: FieldValue): value is ModelRef | ModelDef<ModelFieldsInput> {
  return isModelRef(value) || ("flow" in value && "fields" in value);
}

function fieldSchema(value: FieldValue): ScalarSchema {
  if (isRelationField(value)) {
    return uuidSchema;
  }
  return value.schema;
}

function externalFieldsSchema<I extends Record<string, ScalarTypeDef>>(fields: I) {
  const shape: Record<string, ScalarSchema> = {};
  for (const [key, field] of Object.entries(fields)) {
    shape[key] = field.schema;
  }
  return z.object(shape);
}

function domainFieldsSchema(fields: FieldsMap) {
  const shape: Record<string, ScalarSchema> = {};
  for (const [key, value] of Object.entries(fields)) {
    shape[key] = fieldSchema(value);
  }
  return z.object(shape);
}

function partialFieldsSchema(fields: FieldsMap) {
  return domainFieldsSchema(fields).partial();
}

type InferTypeDef<D extends ScalarTypeDef> = D extends NumericTypeDef
  ? number
  : D extends CoordinateTypeDef
    ? Coordinate
    : D extends PlainTypeDef<infer T, infer _G>
      ? T
      : never;

export type FilterFieldInput = {
  eq?: EntityValue;
  ne?: EntityValue;
  gt?: number | string;
  gte?: number | string;
  lt?: number | string;
  lte?: number | string;
  like?: string;
  ilike?: string;
  startsWith?: string;
  endsWith?: string;
  in?: readonly EntityValue[];
  contains?: string;
  near?: Coordinate | readonly [number, number, number];
};

export type FilterInput = Record<string, FilterFieldInput>;

const filterCoordinateValue = z.tuple([z.number(), z.number()]);
const filterNearValue = z.union([
  filterCoordinateValue,
  z.tuple([z.number(), z.number(), z.number()]),
]);

function compareNumberFilterSchema() {
  return z
    .object({
      eq: z.number(),
      ne: z.number(),
      gt: z.number(),
      gte: z.number(),
      lt: z.number(),
      lte: z.number(),
      in: z.array(z.number()),
    })
    .partial();
}

function compareStringFilterSchema() {
  return z
    .object({
      eq: z.string(),
      ne: z.string(),
      gt: z.string(),
      gte: z.string(),
      lt: z.string(),
      lte: z.string(),
      in: z.array(z.string()),
    })
    .partial();
}

function stringPatternFilterSchema() {
  return z
    .object({
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
    })
    .partial();
}

function uuidFilterSchema() {
  return z
    .object({
      eq: z.string().uuid(),
      ne: z.string().uuid(),
      in: z.array(z.string().uuid()),
    })
    .partial();
}

function booleanFilterSchema() {
  return z
    .object({
      eq: z.boolean(),
      ne: z.boolean(),
    })
    .partial();
}

function coordinateFilterSchema() {
  return z
    .object({
      eq: filterCoordinateValue,
      ne: filterCoordinateValue,
      near: filterNearValue,
    })
    .partial();
}

function jsonFilterSchema() {
  return z
    .object({
      eq: z.string(),
      ne: z.string(),
      contains: z.string(),
    })
    .partial();
}

function geometricFilterSchema() {
  return z
    .object({
      eq: z.string(),
      ne: z.string(),
    })
    .partial();
}

function filterFieldSchemaFor(group: FilterGroup) {
  switch (group) {
    case "numeric":
      return compareNumberFilterSchema();
    case "bigint":
    case "decimal":
      return compareStringFilterSchema();
    case "string":
      return stringPatternFilterSchema();
    case "uuid":
      return uuidFilterSchema();
    case "boolean":
      return booleanFilterSchema();
    case "temporal":
      return compareStringFilterSchema();
    case "coordinate":
      return coordinateFilterSchema();
    case "json":
      return jsonFilterSchema();
    case "geometric":
    case "binary":
      return geometricFilterSchema();
  }
}

function buildFilterSchema(fields: FieldsMap) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, value] of Object.entries(fields)) {
    shape[key] = filterFieldSchemaFor(filterGroupOf(value));
  }
  return z.object(shape).partial();
}

function filterGroupOf(value: FieldValue): FilterGroup {
  if (isRelationField(value)) {
    return "uuid";
  }
  return value.filterGroup;
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

export type FilterView<_F extends FieldsMap = FieldsMap> = FilterInput &
  Record<string, RuntimeFilterOps>;

type FilterState = FilterInput;

type RuntimeFilterOps = {
  eq(value: EntityValue): RuntimeFilterOps;
  ne(value: EntityValue): RuntimeFilterOps;
  gt(value: number | string): RuntimeFilterOps;
  gte(value: number | string): RuntimeFilterOps;
  lt(value: number | string): RuntimeFilterOps;
  lte(value: number | string): RuntimeFilterOps;
  like(value: string): RuntimeFilterOps;
  ilike(value: string): RuntimeFilterOps;
  startsWith(value: string): RuntimeFilterOps;
  endsWith(value: string): RuntimeFilterOps;
  in(values: readonly EntityValue[]): RuntimeFilterOps;
  contains(value: string): RuntimeFilterOps;
  near(x: number, y: number, meters: number): RuntimeFilterOps;
};

type FilterOpValue =
  | EntityValue
  | number
  | string
  | readonly EntityValue[]
  | Coordinate
  | readonly [number, number, number];

function assignFilterOp(state: FilterState, key: string, op: string, value: FilterOpValue) {
  if (key in state) {
    state[key] = { ...state[key], [op]: value };
  } else {
    state[key] = { [op]: value };
  }
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
  const set = (op: string, value: FilterOpValue, enabled: boolean): RuntimeFilterOps => {
    if (enabled) {
      assignFilterOp(state, key, op, value);
    }
    return ops;
  };
  const ops: RuntimeFilterOps = {
    eq: (value) => set("eq", value, true),
    ne: (value) => set("ne", value, true),
    gt: (value) => set("gt", value, config.compare),
    gte: (value) => set("gte", value, config.compare),
    lt: (value) => set("lt", value, config.compare),
    lte: (value) => set("lte", value, config.compare),
    like: (value) => set("like", value, config.stringPattern),
    ilike: (value) => set("ilike", value, config.stringPattern),
    startsWith: (value) => set("startsWith", value, config.stringPattern),
    endsWith: (value) => set("endsWith", value, config.stringPattern),
    in: (values) => set("in", values, config.inList),
    contains: (value) => set("contains", value, config.contains),
    near: (x, y, meters) => set("near", [x, y, meters] as const, config.near),
  };
  return ops;
}

const noFilterOps: FilterOpsConfig = {
  compare: false,
  stringPattern: false,
  inList: false,
  contains: false,
  near: false,
};

const filterOpsConfigByGroup: Record<FilterGroup, FilterOpsConfig> = {
  numeric: { ...noFilterOps, compare: true, inList: true },
  bigint: { ...noFilterOps, compare: true, inList: true },
  decimal: { ...noFilterOps, compare: true, inList: true },
  temporal: { ...noFilterOps, compare: true, inList: true },
  string: { ...noFilterOps, compare: true, stringPattern: true, inList: true },
  uuid: { ...noFilterOps, inList: true },
  boolean: noFilterOps,
  coordinate: { ...noFilterOps, near: true },
  json: { ...noFilterOps, contains: true },
  geometric: noFilterOps,
  binary: noFilterOps,
};

function buildFilterOpsForGroup(
  group: FilterGroup,
  state: FilterState,
  key: string,
): RuntimeFilterOps {
  return buildRuntimeFilterOps(state, key, filterOpsConfigByGroup[group]);
}

function createFilter<F extends FieldsMap>(_fields: F, state: FilterState): FilterView<F> {
  const ops: Record<string, RuntimeFilterOps> = {};
  for (const [key, value] of Object.entries(_fields)) {
    ops[key] = buildFilterOpsForGroup(filterGroupOf(value), state, key);
  }
  return Object.assign({}, state, ops);
}

type ParseOk<T> = { ok: true; value: T };
type ParseFail = { ok: false; signal: "failed" };
type ParseResult<T> = ParseOk<T> | ParseFail;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return isPlainRecord(value);
}

function mapLookup<K, V>(map: Map<K, V>, key: K): V | false {
  const value = map.get(key);
  return value === undefined ? false : value;
}

function parseBodyRecord(
  schema: z.ZodObject<z.ZodRawShape>,
  value: JsonValue,
): ParseResult<EntityRecord> {
  const result = schema.safeParse(value);
  if (!result.success) {
    return { ok: false, signal: Failed };
  }
  const record = entityRecordFromPlain(result.data);
  return { ok: true, value: record };
}

function parseFilter(
  schema: z.ZodObject<z.ZodRawShape>,
  value: JsonValue,
): ParseResult<FilterInput> {
  const result = schema.safeParse(value);
  if (!result.success) {
    return { ok: false, signal: Failed };
  }
  const record: FilterInput = {};
  for (const [key, entry] of Object.entries(result.data)) {
    if (isPlainRecord(entry)) {
      record[key] = entry;
    }
  }
  return { ok: true, value: record };
}

type InferExternalInputFrom<I extends Record<string, ScalarTypeDef>> = {
  [K in keyof I]: InferTypeDef<I[K]>;
};

type InferExternalOutputFrom<O extends Record<string, ScalarTypeDef>> = {
  [K in keyof O]: InferTypeDef<O[K]>;
};

type ModelFieldsInput = Record<string, ScalarTypeDef | ModelRef>;

type SystemFieldKey = "id" | "createdAt" | "updatedAt" | "isDeleted";

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
  return key === "id" || key === "createdAt" || key === "updatedAt" || key === "isDeleted";
}

export type InferDomainBody<D extends ModelFieldsInput> = InferCreateBody<D>;

export type EntityOf<F extends FieldsMap> = InferFields<F>;

function domainFieldsFrom(fields: FieldsMap): FieldsMap {
  const domain: Record<string, FieldValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!isSystemFieldKey(key)) {
      domain[key] = value;
    }
  }
  return domain;
}

function isCreateBody<D extends ModelFieldsInput>(
  model: ModelDef<D>,
  record: EntityRecord,
): record is InferCreateBody<D> {
  return model.validateCreateBody(record).ok;
}

function domainBodyFromRecord<D extends ModelFieldsInput>(
  record: InferCreateBody<D>,
): WritableBody<NormalizeModelFields<D>> {
  return record;
}

function mergeUpdateBody<D extends ModelFieldsInput>(
  model: ModelDef<D>,
  record: EntityRecord,
): EntityRecord {
  const domain = domainFieldsFrom(model.fields);
  const merged: EntityRecord = {};
  for (const key of Object.keys(domain)) {
    const value = record[key];
    if (isEntityValue(value)) {
      merged[key] = value;
    }
  }
  return merged;
}

function updateBodyRecord<D extends ModelFieldsInput>(
  body: UpdateBody<EntityFieldsOf<D>>,
): EntityRecord {
  return entityRecordFromPlain(body);
}

function createdEntity<D extends ModelFieldsInput>(
  entityId: string,
  body: WritableBody<NormalizeModelFields<D>>,
): ModelEntity<D> {
  const now = isoNow();
  return {
    ...body,
    id: entityId,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };
}

function isoNow(): string {
  return new Date().toISOString();
}

function stampUpdate<D extends ModelFieldsInput>(
  existing: EntityRecord,
  domain: UpdateBody<EntityFieldsOf<D>> | WritableBody<NormalizeModelFields<D>> | EntityRecord,
): EntityRecord {
  return {
    ...existing,
    ...domain,
    updatedAt: isoNow(),
  };
}

function stampSoftDelete(entity: EntityRecord): EntityRecord {
  return {
    ...entity,
    isDeleted: true,
    updatedAt: isoNow(),
  };
}

function entityStoreKey(modelName: string, entityId: string): string {
  return `${modelName}:${entityId}`;
}

type PgQueryable = {
  query: pg.Pool["query"];
};

type PgClient = PgQueryable & { release: () => void };

export type InjectablePool = PgQueryable & {
  connect: () => Promise<PgClient>;
  end?: () => Promise<void>;
};

const outboxTableName = "public.fookie_outbox";

function toSnakeCase(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function tableNameFor(modelName: string): string {
  return toSnakeCase(modelName);
}

function columnNameFor(fieldKey: string): string {
  return toSnakeCase(fieldKey);
}

function pgColumnType(field: FieldValue): string {
  if (isRelationField(field)) {
    return "UUID";
  }
  const group = field.filterGroup;
  if (group === "numeric") {
    const kind = field.kind;
    if (kind === "smallint" || kind === "integer" || kind === "int" || kind === "serial") {
      return "INTEGER";
    }
    if (kind === "currency" || kind === "money") {
      return "NUMERIC";
    }
    return "DOUBLE PRECISION";
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
    return "TIMESTAMPTZ";
  }
  if (group === "coordinate") {
    return "POINT";
  }
  if (group === "json") {
    return "JSONB";
  }
  return "TEXT";
}

function entityValueToPg(value: EntityValue, group: FilterGroup): string | number | boolean {
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (group === "json") {
    return JSON.stringify(value);
  }
  return `(${value[0]},${value[1]})`;
}

function parsePgValue(raw: string | number | boolean, group: FilterGroup): EntityValue {
  if (typeof raw === "number" || typeof raw === "boolean") {
    return raw;
  }
  if (group === "coordinate") {
    const match = raw.match(/^\(([-\d.]+),([-\d.]+)\)$/);
    if (match) {
      const point: Coordinate = [Number(match[1]), Number(match[2])];
      return point;
    }
  }
  if (group === "numeric") {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  if (group === "boolean") {
    return raw === "true" || raw === "t";
  }
  return raw;
}

function fieldGroupFor(model: ModelDef<ModelFieldsInput>, key: string): FilterGroup {
  const field = model.fields[key];
  if (!field) {
    return "string";
  }
  return filterGroupOf(field);
}

type DbErrorBox = { message: string };

function dbErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function captureDbError(err: unknown, errorBox: DbErrorBox): void {
  errorBox.message = dbErrorMessage(err);
}

type PgParam = string | number | boolean;

function pgCellValue(raw: unknown): PgParam {
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return raw;
  }
  return String(raw);
}

function pgRowCells(row: pg.QueryResultRow): Record<string, PgParam> {
  const cells: Record<string, PgParam> = {};
  for (const key of Object.keys(row)) {
    cells[key] = pgCellValue(row[key]);
  }
  return cells;
}

function isEntityValue(value: unknown): value is EntityValue {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return true;
  }
  return false;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function nearPoint(near: Coordinate | readonly [number, number, number]): {
  x: number;
  y: number;
  meters: number;
} {
  const meters = near.length > 2 && typeof near[2] === "number" ? near[2] : 0;
  return { x: near[0], y: near[1], meters };
}

type SqlWhere = {
  sql: string;
  params: PgParam[];
};

function buildWhereClause(model: ModelDef<ModelFieldsInput>, filter: FilterState): SqlWhere {
  const parts: string[] = ["is_deleted = false"];
  const params: PgParam[] = [];
  let index = 1;
  for (const [key, clause] of Object.entries(filter)) {
    const col = columnNameFor(key);
    const group = fieldGroupFor(model, key);
    if (clause.eq !== undefined) {
      parts.push(`${col} = $${index}`);
      params.push(entityValueToPg(clause.eq, group));
      index += 1;
    }
    if (clause.ne !== undefined) {
      parts.push(`${col} <> $${index}`);
      params.push(entityValueToPg(clause.ne, group));
      index += 1;
    }
    if (clause.gt !== undefined) {
      parts.push(`${col} > $${index}`);
      params.push(clause.gt);
      index += 1;
    }
    if (clause.gte !== undefined) {
      parts.push(`${col} >= $${index}`);
      params.push(clause.gte);
      index += 1;
    }
    if (clause.lt !== undefined) {
      parts.push(`${col} < $${index}`);
      params.push(clause.lt);
      index += 1;
    }
    if (clause.lte !== undefined) {
      parts.push(`${col} <= $${index}`);
      params.push(clause.lte);
      index += 1;
    }
    if (clause.like !== undefined) {
      parts.push(`${col} LIKE $${index}`);
      params.push(clause.like);
      index += 1;
    }
    if (clause.ilike !== undefined) {
      parts.push(`${col} ILIKE $${index}`);
      params.push(clause.ilike);
      index += 1;
    }
    if (clause.startsWith !== undefined) {
      parts.push(`${col} LIKE $${index}`);
      params.push(`${escapeLikePattern(clause.startsWith)}%`);
      index += 1;
    }
    if (clause.endsWith !== undefined) {
      parts.push(`${col} LIKE $${index}`);
      params.push(`%${escapeLikePattern(clause.endsWith)}`);
      index += 1;
    }
    if (clause.contains !== undefined && group === "json") {
      parts.push(`${col}::text ILIKE $${index}`);
      params.push(`%${escapeLikePattern(clause.contains)}%`);
      index += 1;
    }
    if (clause.in !== undefined && clause.in.length > 0) {
      const slots: string[] = [];
      for (const item of clause.in) {
        slots.push(`$${index}`);
        params.push(entityValueToPg(item, group));
        index += 1;
      }
      parts.push(`${col} IN (${slots.join(", ")})`);
    }
    if (clause.near !== undefined) {
      const point = nearPoint(clause.near);
      parts.push(`${col} <@ circle(point($${index}, $${index + 1}), $${index + 2})`);
      params.push(point.x, point.y, point.meters);
      index += 3;
    }
  }
  return { sql: parts.join(" AND "), params };
}

function rowToEntity(
  model: ModelDef<ModelFieldsInput>,
  row: Record<string, PgParam>,
): EntityRecord {
  const entity: EntityRecord = {};
  for (const [col, raw] of Object.entries(row)) {
    const key = toCamelCase(col);
    entity[key] = parsePgValue(raw, fieldGroupFor(model, key));
  }
  return entity;
}

class PostgresStore {
  private readonly db: PgQueryable;

  constructor(db: PgQueryable) {
    this.db = db;
  }

  withClient(client: PgQueryable): PostgresStore {
    return new PostgresStore(client);
  }

  async ensureAllTables(
    models: ReadonlyArray<ModelDef<ModelFieldsInput>>,
    errorBox: DbErrorBox,
  ): Promise<boolean> {
    for (const model of models) {
      const ok = await this.ensureModelTable(model, errorBox);
      if (!ok) {
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
    const columns: string[] = [];
    for (const [key, field] of Object.entries(model.fields)) {
      const col = columnNameFor(key);
      const type = pgColumnType(field);
      const notNull =
        key === "id" || key === "createdAt" || key === "updatedAt" || key === "isDeleted";
      columns.push(`${col} ${type}${notNull ? " NOT NULL" : ""}`);
    }
    const sql = `CREATE TABLE IF NOT EXISTS ${qualified} (${columns.join(", ")}, PRIMARY KEY (id))`;
    try {
      await this.db.query(sql);
      for (const [key, field] of Object.entries(model.fields)) {
        if (!isRelationField(field) && field.meta.unique) {
          const col = columnNameFor(key);
          await this.db.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_${col}_uidx ON ${qualified} (${col})`,
          );
        }
        if (!isRelationField(field) && field.meta.index && !field.meta.unique) {
          const col = columnNameFor(key);
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
    const table = `public.${tableNameFor(model.name)}`;
    const keys = Object.keys(model.fields);
    const columns = keys.map((key) => columnNameFor(key));
    const values = keys.map((key) => {
      const group = fieldGroupFor(model, key);
      const raw = entity[key];
      if (!isEntityValue(raw)) {
        return key === "isDeleted" ? false : "";
      }
      return entityValueToPg(raw, group);
    });
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const updates = columns.filter((col) => col !== "id").map((col) => `${col} = EXCLUDED.${col}`);
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`;
    try {
      await this.db.query(sql, values);
      return true;
    } catch {
      return false;
    }
  }

  async loadEntity(
    model: ModelDef<ModelFieldsInput>,
    entityId: string,
  ): Promise<EntityRecord | false> {
    const table = `public.${tableNameFor(model.name)}`;
    const sql = `SELECT * FROM ${table} WHERE id = $1 AND is_deleted = false`;
    try {
      const result = await this.db.query(sql, [entityId]);
      if (result.rowCount === 0) {
        return false;
      }
      const row = pgRowCells(result.rows[0]);
      return rowToEntity(model, row);
    } catch {
      return false;
    }
  }

  async queryEntities(
    model: ModelDef<ModelFieldsInput>,
    filter: FilterState,
  ): Promise<EntityRecord[]> {
    const table = `public.${tableNameFor(model.name)}`;
    const where = buildWhereClause(model, filter);
    const sql = `SELECT * FROM ${table} WHERE ${where.sql}`;
    try {
      const result = await this.db.query(sql, where.params);
      return result.rows.map((row) => rowToEntity(model, pgRowCells(row)));
    } catch {
      return [];
    }
  }

  async saveOutboxEntry(entry: OutboxEntry): Promise<boolean> {
    const output = entry.status === "completed" ? JSON.stringify(entry.output) : null;
    const sql = `INSERT INTO ${outboxTableName} (external_id, name, status, input, output, entity_id, model, run_id, attempt)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
    ON CONFLICT (external_id) DO UPDATE SET status = EXCLUDED.status, output = EXCLUDED.output, attempt = EXCLUDED.attempt`;
    try {
      await this.db.query(sql, [
        entry.externalId,
        entry.name,
        entry.status,
        JSON.stringify(entry.input),
        output,
        entry.entityId,
        entry.model,
        entry.runId,
        entry.attempt,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async loadOutbox(outbox: Map<string, OutboxEntry>, errorBox: DbErrorBox): Promise<boolean> {
    const sql = `SELECT external_id, name, status, input, output, entity_id, model, run_id, attempt FROM ${outboxTableName}`;
    try {
      const result = await this.db.query(sql);
      for (const row of result.rows) {
        const entry = outboxEntryFromRow(row);
        if (entry !== false) {
          outbox.set(entry.externalId, entry);
        }
      }
      return true;
    } catch (err) {
      captureDbError(err, errorBox);
      return false;
    }
  }
}

function outboxEntryFromRow(row: pg.QueryResultRow): OutboxEntry | false {
  const status = pgCellToString(row.status);
  const input = entityRecordFromJson(row.input);
  const attemptRaw = row.attempt;
  const attempt = typeof attemptRaw === "number" ? attemptRaw : Number(pgCellToString(attemptRaw));
  if (!isOutboxStatus(status) || input === false || attempt < 1) {
    return false;
  }
  const base = {
    externalId: pgCellToString(row.external_id),
    name: pgCellToString(row.name),
    entityId: pgCellToString(row.entity_id),
    model: pgCellToString(row.model),
    runId: pgCellToString(row.run_id),
    attempt,
    input,
  };
  if (status === "pending" || status === "failed") {
    return { ...base, status };
  }
  const output = entityRecordFromJson(row.output);
  if (output === false) {
    return false;
  }
  return { ...base, status: "completed", output };
}

async function getEntity(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
): Promise<EntityRecord> {
  const key = entityStoreKey(model.name, entityId);
  const cached = mapLookup(rt.entities, key);
  if (cached !== false && cached.id === entityId) {
    return cached;
  }
  const fromDb = await rt.store.loadEntity(model, entityId);
  if (fromDb !== false) {
    rt.entities.set(key, fromDb);
    return fromDb;
  }
  return emptyEntityRecord;
}

async function persistEntity(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  entity: EntityRecord,
): Promise<boolean> {
  await rt.awaitDb();
  rt.pendingEntityWrites.push({ key: entityStoreKey(model.name, entityId), entity });
  return rt.store.upsertEntity(model, entity);
}

function isExternalInput<I extends Record<string, ScalarTypeDef>>(
  fields: I,
  value: JsonValue,
): value is InferExternalInputFrom<I> {
  return externalFieldsSchema(fields).safeParse(value).success;
}

function parseExternalInput<I extends Record<string, ScalarTypeDef>>(
  fields: I,
  value: JsonValue,
): ParseResult<InferExternalInputFrom<I>> {
  if (!isExternalInput(fields, value)) {
    return { ok: false, signal: Failed };
  }
  return { ok: true, value };
}

function isExternalOutput<O extends Record<string, ScalarTypeDef>>(
  fields: O,
  value: JsonValue,
): value is InferExternalOutputFrom<O> {
  return externalFieldsSchema(fields).safeParse(value).success;
}

function parseExternalOutput<O extends Record<string, ScalarTypeDef>>(
  fields: O,
  value: JsonValue,
): ParseResult<InferExternalOutputFrom<O>> {
  if (!isExternalOutput(fields, value)) {
    return { ok: false, signal: Failed };
  }
  return { ok: true, value };
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

export type UpdateBody<F extends FieldsMap> = Partial<{
  [K in keyof InferFields<F> as K extends SystemFieldKey ? never : K]: InferFields<F>[K];
}>;

type WritableBody<F extends FieldsMap> = {
  -readonly [K in keyof InferFields<F>]: InferFields<F>[K];
};

type LogFieldValue = EntityValue | FilterInput;

type ExternalResult<T> =
  { signal: "running" } | { signal: "failed" } | { signal: "done"; output: T };

export type NestedResult =
  | { signal: "running" }
  | { signal: "failed" }
  | { signal: "done" }
  | { signal: "done"; id: string; entity: EntityRecord };

export type SystemEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
};

export type CreateResult<E extends EntityRecord> =
  | { signal: "running"; runId: string }
  | { signal: "failed" }
  | { signal: "done"; id: string; entity: E };

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
  validateCreateBody: (body: JsonValue) => ParseResult<EntityRecord>;
  validateUpdateBody: (body: JsonValue) => ParseResult<EntityRecord>;
  validateListFilter: (filter: JsonValue) => ParseResult<FilterInput>;
  validateUpdateFilter: (filter: JsonValue) => ParseResult<FilterInput>;
  validateDeleteFilter: (filter: JsonValue) => ParseResult<FilterInput>;
};

export function flows<D extends ModelFieldsInput>(handlers: FlowHandlers<D>): FlowHandlers<D> {
  return handlers;
}

export function Model<const F extends ModelFieldsInput>(config: {
  name: string;
  fields: ModelFieldsInput & F;
  flow: FlowHandlers<F>;
}): ModelDef<F> {
  const domainFields = domainFieldsFrom(config.fields);
  const entityFields = {
    ...domainFields,
    ...systemFieldDefs,
  };

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

export type ExternalConfig<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> = {
  name: string;
  input: I;
  output: O;
  attempts: number;
  backoff: "fixed" | "exponential";
};

export interface ExternalDef<
  I extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef> = Record<string, ScalarTypeDef>,
> extends ExternalConfig<I, O> {
  validateInput(value: JsonValue): ParseResult<InferExternalInputFrom<I>>;
  validateOutput(value: JsonValue): ParseResult<InferExternalOutputFrom<O>>;
}

export function External<
  const I extends Record<string, ScalarTypeDef>,
  const O extends Record<string, ScalarTypeDef>,
>(config: ExternalConfig<I, O>): ExternalDef<I, O> {
  return {
    ...config,
    validateInput: (value) => parseExternalInput(config.input, value),
    validateOutput: (value) => parseExternalOutput(config.output, value),
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

const observabilityBufferLimit = 10_000;
const runBufferLimit = 10_000;

function pushBounded<T>(buffer: T[], entry: T): void {
  if (buffer.length >= observabilityBufferLimit) {
    buffer.shift();
  }
  buffer.push(entry);
}

type ObsScope = {
  traceId: string;
  model: string;
  entityId: string;
  operation: string;
};

class Observability {
  readonly logs: LogEntry[] = [];
  readonly metrics: MetricEntry[] = [];
  readonly spans: SpanEntry[] = [];
  private readonly tracer = trace.getTracer("fookie");
  private readonly meter = otelMetrics.getMeter("fookie");
  private readonly counters = new Map<string, Counter>();
  private readonly histograms = new Map<string, Histogram>();

  info(scope: ObsScope, message: string, fields: Record<string, LogFieldValue>): void {
    this.write("info", scope, message, fields);
  }

  error(scope: ObsScope, message: string, fields: Record<string, LogFieldValue>): void {
    this.write("error", scope, message, fields);
  }

  count(scope: ObsScope, name: string): void {
    this.record(scope, name, 1);
    this.counterFor(name).add(1, { model: scope.model });
  }

  measure(scope: ObsScope, name: string, value: number): void {
    this.record(scope, name, value);
    this.histogramFor(name).record(value, { model: scope.model });
  }

  runSpan<T>(
    scope: ObsScope,
    name: string,
    attributes: Attributes,
    run: (span: Span) => Promise<T>,
  ): Promise<T> {
    const startedAt = new Date().toISOString();
    const spanAttributes: Attributes = {
      model: scope.model,
      entityId: scope.entityId,
      operation: scope.operation,
      runId: scope.traceId,
      ...attributes,
    };
    return this.tracer.startActiveSpan(name, { attributes: spanAttributes }, async (span) => {
      try {
        return await run(span);
      } catch (err) {
        span.recordException(dbErrorMessage(err));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
        pushBounded(this.spans, {
          name,
          traceId: scope.traceId,
          model: scope.model,
          entityId: scope.entityId,
          operation: scope.operation,
          startedAt,
          endedAt: new Date().toISOString(),
        });
      }
    });
  }

  private write(
    level: string,
    scope: ObsScope,
    message: string,
    fields: Record<string, LogFieldValue>,
  ): void {
    const entry: LogEntry = {
      level,
      message,
      traceId: scope.traceId,
      model: scope.model,
      entityId: scope.entityId,
      operation: scope.operation,
      timestamp: new Date().toISOString(),
      fields,
    };
    pushBounded(this.logs, entry);
    process.stdout.write(`${logLineFromEntry(entry)}\n`);
  }

  private record(scope: ObsScope, name: string, value: number): void {
    pushBounded(this.metrics, {
      name: `${scope.model.toLowerCase()}.${name}`,
      value,
      traceId: scope.traceId,
      model: scope.model,
      timestamp: new Date().toISOString(),
    });
  }

  private counterFor(name: string): Counter {
    const existing = mapLookup(this.counters, name);
    if (existing !== false) {
      return existing;
    }
    const created = this.meter.createCounter(`fookie.${name}`);
    this.counters.set(name, created);
    return created;
  }

  private histogramFor(name: string): Histogram {
    const existing = mapLookup(this.histograms, name);
    if (existing !== false) {
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
  dbLastError: () => string;
  listResults: EntityRecord[];
  pendingExternalEvents: PendingExternalEvent[];
  pendingEntityWrites: PendingEntityWrite[];
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
} & (
  | { status: "pending" }
  | { status: "failed" }
  | { status: "completed"; output: InferExternalOutputFrom<O> }
);

function entityRecordFromPlain(raw: Record<string, unknown>): EntityRecord {
  const entity: EntityRecord = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isEntityValue(value)) {
      entity[key] = value;
    }
  }
  return entity;
}

function entityRecordFromJson(raw: JsonValue): EntityRecord | false {
  if (!isPlainRecord(raw)) {
    return false;
  }
  return entityRecordFromPlain(raw);
}

function pgCellToString(raw: unknown): string {
  return String(pgCellValue(raw));
}

function isOutboxStatus(value: string): value is "pending" | "failed" | "completed" {
  return value === "pending" || value === "failed" || value === "completed";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function backoffDelayMs(backoff: "fixed" | "exponential", attempt: number): number {
  if (backoff === "fixed") {
    return 10;
  }
  return 10 * 2 ** (attempt - 1);
}

function obsScope(rt: Runtime): ObsScope {
  return {
    traceId: rt.traceId,
    model: rt.model.name,
    entityId: rt.entityId,
    operation: rt.operation,
  };
}

function logLineFromEntry(entry: LogEntry): string {
  const payload: Record<string, LogFieldValue | string> = {
    level: entry.level,
    message: entry.message,
    traceId: entry.traceId,
    model: entry.model,
    entityId: entry.entityId,
    operation: entry.operation,
    timestamp: entry.timestamp,
  };
  for (const [key, value] of Object.entries(entry.fields)) {
    payload[key] = value;
  }
  return JSON.stringify(payload);
}

async function emitExternalHandler<E extends readonly ExternalDef[]>(
  handler: (event: ExternalEventOf<E[number]>) => Promise<void>,
  ext: ExternalDef,
  externalId: string,
  input: EntityRecord,
): Promise<void> {
  const parsed = parseExternalInput(ext.input, input);
  if (!parsed.ok) {
    return;
  }
  await handler({
    externalId,
    name: ext.name,
    input: parsed.value,
  });
}

function flushPendingEntityWrites(rt: Runtime): void {
  const writes = rt.pendingEntityWrites.splice(0, rt.pendingEntityWrites.length);
  for (const write of writes) {
    rt.entities.set(write.key, write.entity);
  }
}

async function flushPendingExternalEvents(rt: Runtime): Promise<void> {
  const events = rt.pendingExternalEvents.splice(0, rt.pendingExternalEvents.length);
  for (const event of events) {
    const ext = resolveExternalByName(rt.externals, event.name);
    if (ext === false) {
      continue;
    }
    await emitExternalHandler(rt.onExternalEvent, ext, event.externalId, event.input);
  }
}

function resolveExternalByName<E extends readonly ExternalDef[]>(
  externals: E,
  name: string,
): E[number] | false {
  for (const ext of externals) {
    if (ext.name === name) {
      return ext;
    }
  }
  return false;
}

async function withWriteTransaction(
  rt: Runtime,
  run: (txRt: Runtime) => Promise<Signal>,
): Promise<Signal> {
  let client: PgClient | false = false;
  try {
    client = await rt.pool.connect();
  } catch (err) {
    rt.reportDbError(dbErrorMessage(err));
    return Failed;
  }
  try {
    await client.query("BEGIN");
    const txRt: Runtime = { ...rt, store: rt.store.withClient(client) };
    const signal = await run(txRt);
    if (signal === Failed) {
      txRt.pendingExternalEvents.length = 0;
      txRt.pendingEntityWrites.length = 0;
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
      flushPendingEntityWrites(txRt);
      await flushPendingExternalEvents(txRt);
    }
    return signal;
  } catch {
    try {
      rt.pendingExternalEvents.length = 0;
      rt.pendingEntityWrites.length = 0;
      await client.query("ROLLBACK");
    } catch {
      return Failed;
    }
    return Failed;
  } finally {
    client.release();
  }
}

const emptyEntityRecord: EntityRecord = {};
const emptyFilterInput: FilterInput = {};

function resolveModel(rt: Runtime, target: ModelRef): ModelDef<ModelFieldsInput> | false {
  for (const model of rt.models) {
    if (model.name === target.name) {
      return model;
    }
  }
  return false;
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
      const child = resolveModel(rt, target);
      if (!child) {
        return Promise.resolve({ signal: Failed });
      }
      return runCreate(rt, child, body, parent, parentEntityId);
    },
    list(target, filter) {
      const child = resolveModel(rt, target);
      if (!child) {
        return Promise.resolve({ signal: Failed });
      }
      return runNestedList(rt, child, filter, parent, parentEntityId);
    },
    update(target, input) {
      const child = resolveModel(rt, target);
      if (!child) {
        return Promise.resolve({ signal: Failed });
      }
      return runNestedUpdate(rt, child, input, parent, parentEntityId);
    },
    delete(target, input) {
      const child = resolveModel(rt, target);
      if (!child) {
        return Promise.resolve({ signal: Failed });
      }
      return runNestedDelete(rt, child, input, parent, parentEntityId);
    },
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
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function externalId<I extends Record<string, ScalarTypeDef>>(
  entityId: string,
  name: string,
  input: InferExternalInputFrom<I>,
): string {
  const record: EntityRecord = input;
  const sortedKeys = Object.keys(record).sort();
  const parts = sortedKeys.map((key) => `${key}=${JSON.stringify(record[key])}`);
  return `${entityId}:${name}:${parts.join(",")}`;
}

function createObservability(rt: Runtime) {
  const scope = obsScope(rt);
  return {
    log(message: string, fields: Record<string, LogFieldValue>) {
      rt.obs.info(scope, message, fields);
      return true;
    },
    increment(name: string) {
      rt.obs.count(scope, name);
      return true;
    },
    histogram(name: string, value: number) {
      rt.obs.measure(scope, name, value);
      return true;
    },
  };
}

function traceSpan<T>(rt: Runtime, name: string, run: () => Promise<T>): Promise<T> {
  return rt.obs.runSpan(obsScope(rt), name, {}, run);
}

async function runExternal<
  I extends Record<string, ScalarTypeDef>,
  O extends Record<string, ScalarTypeDef>,
>(
  rt: Runtime,
  ext: ExternalDef<I, O>,
  input: InferExternalInputFrom<I>,
): Promise<ExternalResult<InferExternalOutputFrom<O>>> {
  const validated = ext.validateInput(input);
  if (!validated.ok) {
    return { signal: Failed };
  }

  const id = externalId(rt.entityId, ext.name, validated.value);
  const scope = obsScope(rt);
  return rt.obs.runSpan(
    scope,
    ext.name,
    { externalName: ext.name, externalId: id },
    async (span) => {
      const existing = mapLookup(rt.outbox, id);

      if (existing !== false && existing.status === "completed") {
        const outputValid = parseExternalOutput(ext.output, existing.output);
        if (!outputValid.ok) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: "external output invalid" });
          return { signal: Failed };
        }
        span.setAttribute("signal", Done);
        return {
          output: outputValid.value,
          signal: Done,
        };
      }

      if (existing !== false && existing.status === "failed") {
        span.setAttribute("signal", Failed);
        span.setStatus({ code: SpanStatusCode.ERROR, message: "external failed" });
        return { signal: Failed };
      }

      if (existing === false) {
        const pending: OutboxEntry = {
          externalId: id,
          name: ext.name,
          status: "pending",
          input: validated.value,
          entityId: rt.entityId,
          model: rt.model.name,
          runId: rt.traceId,
          attempt: 1,
        };
        rt.outbox.set(id, pending);
        await rt.store.saveOutboxEntry(pending);
        rt.obs.count(scope, "external.dispatched");
        rt.obs.info(scope, "external.dispatch", { externalId: id, externalName: ext.name });
        rt.pendingExternalEvents.push({ externalId: id, name: ext.name, input: validated.value });
      }

      span.setAttribute("signal", Running);
      return { signal: Running };
    },
  );
}

type FlowRun<D extends ModelFieldsInput = ModelFieldsInput> = {
  id: string;
  model: ModelDef<D>;
  operation: "create" | "list" | "update" | "delete";
  entityId: string;
  body: InferCreateBody<D> | EntityRecord;
  filter: FilterState;
  entity: EntityRecord;
  created: ModelEntity<D> | false;
  results: EntityRecord[];
  signal: Signal;
};

function scopedRuntime(
  rt: Runtime,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
  operation: string,
): Runtime {
  return { ...rt, model, entityId, operation };
}

function bindRelationFields(
  child: ModelDef<ModelFieldsInput>,
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
  body: EntityRecord,
): EntityRecord {
  const next = { ...body };
  const fields = domainFieldsFrom(child.fields);
  for (const [key, value] of Object.entries(fields)) {
    if (isRelationField(value) && value.name === parent.name) {
      next[key] = parentEntityId;
    }
  }
  return next;
}

async function runCreate<D extends ModelFieldsInput>(
  rt: Runtime,
  model: ModelDef<D>,
  body: EntityRecord,
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
): Promise<NestedResult> {
  const bound = bindRelationFields(model, parent, parentEntityId, body);
  const validated = model.validateCreateBody(bound);
  if (!validated.ok || !isCreateBody(model, validated.value)) {
    return { signal: Failed };
  }

  const entityId = uuidV7();
  const flowBody = domainBodyFromRecord<D>(validated.value);

  const localRt = scopedRuntime(rt, model, entityId, "create");
  const obs = createObservability(localRt);
  const ops = createFlowModelOps(localRt, model, entityId, obs);

  const flow: CreateFlow<NormalizeModelFields<D>> = {
    id: entityId,
    body: flowBody,
    ...ops,
    external: (ext, input) => runExternal(localRt, ext, input),
  };

  const signal = await localRt.obs.runSpan(
    obsScope(localRt),
    `${model.name.toLowerCase()}.create`,
    {},
    () => model.flow.create(flow),
  );
  localRt.obs.count(obsScope(localRt), "nested.create");

  if (signal === Done) {
    const stored = createdEntity(entityId, flow.body);
    const ok = await persistEntity(rt, model, entityId, stored);
    if (!ok) {
      return { signal: Failed };
    }
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
  const validated = model.validateListFilter(filter);
  if (!validated.ok) {
    return { signal: Failed };
  }

  const entityId = uuidV7();
  const localRt = scopedRuntime(rt, model, entityId, "list");
  const obs = createObservability(localRt);
  const filterState: FilterState = { ...validated.value };
  const flow: ListFlow<FieldsMap> = {
    filter: createFilter(model.fields, filterState),
    ...createFlowModelOps(localRt, parent, parentEntityId, obs),
  };

  const signal = await localRt.obs.runSpan(
    obsScope(localRt),
    `${model.name.toLowerCase()}.list`,
    {},
    () => model.flow.list(flow),
  );
  return toNestedResult(signal);
}

async function runNestedUpdate<D extends ModelFieldsInput>(
  rt: Runtime,
  model: ModelDef<D>,
  input: { id: string; body: EntityRecord; filter: FilterInput },
  parent: ModelDef<ModelFieldsInput>,
  parentEntityId: string,
): Promise<NestedResult> {
  const filterValid = model.validateUpdateFilter(input.filter);
  const bodyValid = model.validateUpdateBody(input.body);
  if (!filterValid.ok || !bodyValid.ok) {
    return { signal: Failed };
  }
  const updateBody = mergeUpdateBody(model, bodyValid.value);

  const localRt = scopedRuntime(rt, model, input.id, "update");
  const obs = createObservability(localRt);
  const filterState: FilterState = { ...filterValid.value };
  const flow: UpdateFlow<EntityFieldsOf<D>> = {
    filter: createFilter(model.fields, filterState),
    id: input.id,
    body: updateBody,
    ...createFlowModelOps(localRt, parent, parentEntityId, obs),
  };

  const signal = await localRt.obs.runSpan(
    obsScope(localRt),
    `${model.name.toLowerCase()}.update`,
    {},
    () => model.flow.update(flow),
  );
  if (signal === Done) {
    const existing = await getEntity(rt, model, input.id);
    if (existing.id !== input.id) {
      return { signal: Failed };
    }
    const stored = stampUpdate(existing, { ...bodyValid.value, ...flow.body });
    const ok = await persistEntity(rt, model, input.id, stored);
    if (!ok) {
      return { signal: Failed };
    }
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
  const filterValid = model.validateDeleteFilter(input.filter);
  if (!filterValid.ok) {
    return { signal: Failed };
  }

  const localRt = scopedRuntime(rt, model, input.id, "delete");
  const obs = createObservability(localRt);
  const filterState: FilterState = { ...filterValid.value };
  const flow: DeleteFlow<FieldsMap> = {
    filter: createFilter(model.fields, filterState),
    id: input.id,
    ...createFlowModelOps(localRt, parent, parentEntityId, obs),
  };

  const signal = await localRt.obs.runSpan(
    obsScope(localRt),
    `${model.name.toLowerCase()}.delete`,
    {},
    () => model.flow.delete(flow),
  );
  if (signal === Done) {
    const existing = await getEntity(rt, model, input.id);
    if (existing.id !== input.id) {
      return { signal: Failed };
    }
    const stored = stampSoftDelete(existing);
    const ok = await persistEntity(rt, model, input.id, stored);
    if (!ok) {
      return { signal: Failed };
    }
  }
  return toNestedResult(signal);
}

async function executeRunMutation<D extends ModelFieldsInput>(
  rt: Runtime,
  run: FlowRun<D>,
): Promise<Signal> {
  if (run.operation === "create") {
    const validated = run.model.validateCreateBody(run.body);
    if (!validated.ok || !isCreateBody(run.model, run.body)) {
      return Failed;
    }

    const createBody = run.body;
    const localRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
    const obs = createObservability(localRt);
    const ops = createFlowModelOps(localRt, run.model, run.entityId, obs);

    const flow: CreateFlow<NormalizeModelFields<D>> = {
      id: run.entityId,
      body: createBody,
      ...ops,
      external: (ext, input) => runExternal(localRt, ext, input),
    };

    const signal = await run.model.flow.create(flow);
    if (signal === Done) {
      const stored = createdEntity(run.entityId, flow.body);
      run.entity = stored;
      run.created = stored;
      const ok = await persistEntity(rt, run.model, run.entityId, stored);
      if (!ok) {
        return Failed;
      }
    }
    return signal;
  }

  if (run.operation === "update") {
    const filterValid = run.model.validateUpdateFilter(run.filter);
    const bodyValid = run.model.validateUpdateBody(run.body);
    if (!filterValid.ok || !bodyValid.ok) {
      return Failed;
    }
    const updateBody = mergeUpdateBody(run.model, bodyValid.value);
    const localRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
    const obs = createObservability(localRt);
    const filterState: FilterState = { ...filterValid.value };
    const flow: UpdateFlow<EntityFieldsOf<D>> = {
      filter: createFilter(run.model.fields, filterState),
      id: run.entityId,
      body: updateBody,
      ...createFlowModelOps(localRt, run.model, run.entityId, obs),
    };
    const existing = await getEntity(rt, run.model, run.entityId);
    if (existing.id !== run.entityId) {
      return Failed;
    }
    run.entity = existing;
    const signal = await run.model.flow.update(flow);
    if (signal === Done) {
      const stored = stampUpdate(existing, { ...bodyValid.value, ...flow.body });
      run.entity = stored;
      const ok = await persistEntity(rt, run.model, run.entityId, stored);
      if (!ok) {
        return Failed;
      }
    }
    return signal;
  }

  const filterValid = run.model.validateDeleteFilter(run.filter);
  if (!filterValid.ok) {
    return Failed;
  }
  const localRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
  const obs = createObservability(localRt);
  const filterState: FilterState = { ...filterValid.value };
  const flow: DeleteFlow<EntityFieldsOf<D>> = {
    filter: createFilter(run.model.fields, filterState),
    id: run.entityId,
    ...createFlowModelOps(localRt, run.model, run.entityId, obs),
  };
  const existing = await getEntity(rt, run.model, run.entityId);
  if (existing.id !== run.entityId) {
    return Failed;
  }
  run.entity = existing;
  const signal = await run.model.flow.delete(flow);
  if (signal === Done) {
    const stored = stampSoftDelete(existing);
    run.entity = stored;
    const ok = await persistEntity(rt, run.model, run.entityId, stored);
    if (!ok) {
      return Failed;
    }
  }
  return signal;
}

function reportDatabaseFailure(rt: Runtime): void {
  const reason = rt.dbLastError().length > 0 ? rt.dbLastError() : "database unavailable";
  rt.obs.count(obsScope(rt), "operation.failed");
  rt.obs.error(obsScope(rt), "database unavailable", { reason });
}

async function executeRun<D extends ModelFieldsInput>(
  rt: Runtime,
  run: FlowRun<D>,
): Promise<Signal> {
  const metricRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
  const scope = obsScope(metricRt);
  const spanName = `${run.model.name.toLowerCase()}.${run.operation}`;
  return rt.obs.runSpan(scope, spanName, {}, async (span) => {
    const dbOk = await rt.awaitDb();
    if (!dbOk) {
      reportDatabaseFailure(metricRt);
      span.setAttribute("signal", Failed);
      span.setStatus({ code: SpanStatusCode.ERROR, message: "database unavailable" });
      return Failed;
    }
    const startedAt = Date.now();
    rt.obs.count(scope, "operation.started");
    let signal: Signal = Failed;

    if (run.operation === "list") {
      const validated = run.model.validateListFilter(run.filter);
      if (!validated.ok) {
        rt.obs.measure(scope, "operation.duration", Date.now() - startedAt);
        rt.obs.count(scope, "operation.failed");
        span.setAttribute("signal", Failed);
        span.setStatus({ code: SpanStatusCode.ERROR, message: "invalid filter" });
        return Failed;
      }
      const localRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
      const obs = createObservability(localRt);
      const filterState: FilterState = { ...validated.value };
      const rows = await rt.store.queryEntities(run.model, filterState);
      run.results = rows;
      rt.listResults.splice(0, rt.listResults.length, ...rows);
      const flow: ListFlow<EntityFieldsOf<D>> = {
        filter: createFilter(run.model.fields, filterState),
        ...createFlowModelOps(localRt, run.model, run.entityId, obs),
      };
      signal = await run.model.flow.list(flow);
    } else {
      signal = await withWriteTransaction(rt, (txRt) => executeRunMutation(txRt, run));
      if (signal === Failed) {
        rt.obs.count(scope, "saga.compensate");
        span.addEvent("saga.compensate", { model: run.model.name, entityId: run.entityId });
        rt.obs.info(scope, "saga.compensation_dispatched", { runId: run.id });
      }
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
): ModelDef<ModelFieldsInput> | false {
  const lowered = name.toLowerCase();
  for (const model of models) {
    if (model.name.toLowerCase() === lowered) {
      return model;
    }
  }
  return false;
}

type HttpPayload = JsonObject;

function readJsonBody(req: http.IncomingMessage): Promise<HttpPayload | false> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonValue;
        resolve(isJsonObject(parsed) ? parsed : false);
      } catch {
        resolve(false);
      }
    });
    req.on("error", () => resolve(false));
  });
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  payload: Record<string, string | number | boolean | EntityRecord | EntityRecord[] | Signal>,
) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function recordFromPayload(payload: HttpPayload, key: string): JsonObject {
  const raw = payload[key];
  return raw !== undefined && isJsonObject(raw) ? raw : {};
}

function filterFromPayload(
  model: ModelDef<ModelFieldsInput>,
  payload: HttpPayload,
): FilterInput | false {
  const validated = model.validateListFilter(recordFromPayload(payload, "filter"));
  if (!validated.ok) {
    return false;
  }
  return validated.value;
}

function outboxEntryBase(entry: OutboxEntry) {
  return {
    externalId: entry.externalId,
    name: entry.name,
    entityId: entry.entityId,
    model: entry.model,
    runId: entry.runId,
    input: entry.input,
    attempt: entry.attempt,
  };
}

export function models(...items: ModelDef<ModelFieldsInput>[]): ModelDef<ModelFieldsInput>[] {
  return items;
}

type RegisteredModel = ModelDef<ModelFieldsInput>;

export type AppConfig<E extends readonly ExternalDef[] = readonly ExternalDef[]> = {
  listen: string;
  database: string;
  models: readonly RegisteredModel[];
  externals: E;
  onExternalEvent: (event: ExternalEventOf<E[number]>) => Promise<void>;
  pool?: InjectablePool;
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
  private readonly latestListResults: EntityRecord[] = [];
  private readonly pendingExternalEvents: PendingExternalEvent[] = [];
  private readonly pendingEntityWrites: PendingEntityWrite[] = [];
  private dbReady = false;
  private lastDbError = "";
  private server: http.Server | false = false;

  constructor(config: AppConfig<E>) {
    this.listen = config.listen;
    this.registeredModels = config.models;
    this.externals = config.externals;
    this.onExternalEvent = config.onExternalEvent;
    this.ownsPool = config.pool === undefined;
    this.pool = config.pool ?? new pg.Pool({ connectionString: config.database });
    this.store = new PostgresStore(this.pool);
  }

  async stop(): Promise<boolean> {
    const server = this.server;
    if (server !== false) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
      this.server = false;
    }
    if (this.ownsPool && "end" in this.pool && typeof this.pool.end === "function") {
      await this.pool.end();
    }
    return true;
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
    if (this.server !== false) {
      return true;
    }
    const server = http.createServer((req, res) => {
      this.handleHttp(req, res).catch(() => {
        sendJson(res, 500, { error: "internal error" });
      });
    });
    server.listen(Number(this.listen));
    this.server = server;
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
      body,
      filter: emptyFilterInput,
      entity: emptyEntityRecord,
      created: false,
      results: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    return executeRun(this.runtimeFor(runId, model, entityId, "create"), run).then(
      (signal): CreateResult<ModelEntity<D>> => {
        this.finalizeRun(runId, run, signal);
        if (signal === Done && run.created !== false) {
          return { signal: Done, id: entityId, entity: run.created };
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
    const entityId = uuidV7();
    const run: FlowRun<D> = {
      id: runId,
      model,
      operation: "list",
      entityId,
      body: emptyEntityRecord,
      filter,
      entity: emptyEntityRecord,
      created: false,
      results: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    return executeRun(this.runtimeFor(runId, model, entityId, "list"), run).then((signal) => {
      this.finalizeRun(runId, run, signal);
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
      body: updateBodyRecord(input.body),
      filter: input.filter,
      entity: emptyEntityRecord,
      created: false,
      results: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    return executeRun(this.runtimeFor(runId, model, input.id, "update"), run).then((signal) => {
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
      body: emptyEntityRecord,
      filter: input.filter,
      entity: emptyEntityRecord,
      created: false,
      results: [],
      signal: Running,
    };
    this.runs.set(runId, run);
    return executeRun(this.runtimeFor(runId, model, input.id, "delete"), run).then((signal) => {
      this.finalizeRun(runId, run, signal);
      return signal;
    });
  }

  resume(runId: string): Promise<Signal> {
    const run = mapLookup(this.runs, runId);
    if (run === false) {
      return Promise.resolve(Failed);
    }
    return executeRun(this.runtimeFor(runId, run.model, run.entityId, run.operation), run).then(
      (signal) => {
        this.finalizeRun(runId, run, signal);
        return signal;
      },
    );
  }

  async setExternalResult(result: { externalId: string; output: JsonValue }): Promise<boolean> {
    const entry = mapLookup(this.outbox, result.externalId);
    if (entry === false) {
      return false;
    }
    const ext = resolveExternalByName(this.externals, entry.name);
    if (ext === false) {
      return false;
    }
    const run = mapLookup(this.runs, entry.runId);
    const resolvedModel = resolveModelByName(this.registeredModels, entry.model);
    const firstModel = this.registeredModels[0];
    const metricModel =
      resolvedModel !== false ? resolvedModel : run !== false ? run.model : firstModel;
    if (metricModel === undefined) {
      return false;
    }
    const metricRt = this.runtimeFor(
      entry.runId,
      metricModel,
      entry.entityId,
      run !== false ? run.operation : "create",
    );
    const scope = obsScope(metricRt);
    const spanAttributes = { externalName: entry.name, externalId: entry.externalId };
    return this.obs.runSpan(scope, "external.result", spanAttributes, async (span) => {
      const validated = ext.validateOutput(result.output);
      if (!validated.ok) {
        if (entry.attempt < ext.attempts) {
          const nextAttempt = entry.attempt + 1;
          this.obs.count(scope, "external.retry");
          this.obs.info(scope, "external.retry", {
            externalId: entry.externalId,
            attempt: nextAttempt,
          });
          await this.recordOutbox({
            ...outboxEntryBase(entry),
            attempt: nextAttempt,
            status: "pending",
          });
          await sleep(backoffDelayMs(ext.backoff, nextAttempt));
          await emitExternalHandler(this.onExternalEvent, ext, entry.externalId, entry.input);
          return false;
        }
        this.obs.count(scope, "external.failed");
        this.obs.info(scope, "external.failed", {
          externalId: entry.externalId,
          attempt: entry.attempt,
        });
        span.setStatus({ code: SpanStatusCode.ERROR, message: "external output invalid" });
        await this.recordOutbox({ ...outboxEntryBase(entry), status: "failed" });
        return false;
      }
      this.obs.count(scope, "external.completed");
      this.obs.info(scope, "external.completed", { externalId: entry.externalId });
      await this.recordOutbox({
        ...outboxEntryBase(entry),
        status: "completed",
        output: validated.value,
      });
      const resumeModel = run !== false ? run.model : resolvedModel;
      if (resumeModel === false) {
        return true;
      }
      this.obs.info(scope, "flow.resumed", { runId: entry.runId });
      await this.resume(entry.runId);
      return true;
    });
  }

  patchOutbox(externalId: string, output: EntityRecord): boolean {
    const entry = mapLookup(this.outbox, externalId);
    if (entry === false) {
      return false;
    }
    this.outbox.set(externalId, {
      ...entry,
      status: "completed",
      output,
    });
    return true;
  }

  logs(): LogEntry[] {
    return this.obs.logs;
  }

  metrics(): MetricEntry[] {
    return this.obs.metrics;
  }

  spans(): SpanEntry[] {
    return this.obs.spans;
  }

  listResults(): EntityRecord[] {
    return this.latestListResults;
  }

  private async recordOutbox(entry: OutboxEntry): Promise<void> {
    this.outbox.set(entry.externalId, entry);
    await this.store.saveOutboxEntry(entry);
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
      listResults: this.latestListResults,
      pendingExternalEvents: this.pendingExternalEvents,
      pendingEntityWrites: this.pendingEntityWrites,
      reportDbError: (message: string) => {
        this.lastDbError = message;
      },
      dbLastError: () => this.lastDbError,
      awaitDb: () => this.awaitDb(),
      resume: (runId) => this.resume(runId),
    };
  }

  private async awaitDb(): Promise<boolean> {
    if (this.dbReady) {
      return true;
    }
    const errorBox: DbErrorBox = { message: "" };
    const tablesOk = await this.store.ensureAllTables(this.registeredModels, errorBox);
    if (!tablesOk) {
      this.lastDbError = errorBox.message.length > 0 ? errorBox.message : "database unavailable";
      return false;
    }
    const outboxOk = await this.store.loadOutbox(this.outbox, errorBox);
    if (!outboxOk) {
      this.lastDbError = errorBox.message.length > 0 ? errorBox.message : "database unavailable";
      return false;
    }
    this.dbReady = true;
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
    const payload = await readJsonBody(req);
    if (payload === false) {
      sendJson(res, 400, { error: "invalid body" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://local");
    const parts = url.pathname.split("/").filter((part) => part.length > 0);
    if (parts[0] === "external" && parts[1] === "result") {
      const externalId = typeof payload.externalId === "string" ? payload.externalId : "";
      const output = recordFromPayload(payload, "output");
      const ok = await this.setExternalResult({ externalId, output });
      sendJson(res, ok ? 200 : 400, { ok });
      return;
    }
    if (parts.length < 2) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const model = resolveModelByName(this.registeredModels, parts[0] ?? "");
    if (model === false) {
      sendJson(res, 404, { error: "model not found" });
      return;
    }
    const action = parts[1];
    if (action === "create") {
      const validated = model.validateCreateBody(recordFromPayload(payload, "body"));
      if (!validated.ok) {
        sendJson(res, 400, { error: "invalid body" });
        return;
      }
      const runId = uuidV7();
      const entityId = uuidV7();
      const run: FlowRun<ModelFieldsInput> = {
        id: runId,
        model,
        operation: "create",
        entityId,
        body: validated.value,
        filter: emptyFilterInput,
        entity: emptyEntityRecord,
        created: false,
        results: [],
        signal: Running,
      };
      this.runs.set(runId, run);
      const signal = await executeRun(this.runtimeFor(runId, model, entityId, "create"), run);
      this.finalizeRun(runId, run, signal);
      if (signal === Done && run.created !== false) {
        sendJson(res, 200, { signal: Done, id: entityId, entity: run.created });
        return;
      }
      if (signal === Running) {
        sendJson(res, 200, { signal: Running, runId });
        return;
      }
      sendJson(res, 200, { signal: Failed });
      return;
    }
    if (action === "list") {
      const filter = filterFromPayload(model, payload);
      if (filter === false) {
        sendJson(res, 400, { error: "invalid filter" });
        return;
      }
      const runId = uuidV7();
      const entityId = uuidV7();
      const run: FlowRun<ModelFieldsInput> = {
        id: runId,
        model,
        operation: "list",
        entityId,
        body: emptyEntityRecord,
        filter,
        entity: emptyEntityRecord,
        created: false,
        results: [],
        signal: Running,
      };
      this.runs.set(runId, run);
      const signal = await executeRun(this.runtimeFor(runId, model, entityId, "list"), run);
      this.finalizeRun(runId, run, signal);
      sendJson(res, 200, { signal, results: run.results });
      return;
    }
    if (parts.length < 3) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const routeTail = parts.slice(-2);
    const entityId = routeTail[0] ?? "";
    const mutation = routeTail[1] ?? "";
    if (mutation === "update") {
      const filter = filterFromPayload(model, payload);
      if (filter === false) {
        sendJson(res, 400, { error: "invalid filter" });
        return;
      }
      const bodyValid = model.validateUpdateBody(recordFromPayload(payload, "body"));
      if (!bodyValid.ok) {
        sendJson(res, 400, { error: "invalid body" });
        return;
      }
      const runId = uuidV7();
      const run: FlowRun<ModelFieldsInput> = {
        id: runId,
        model,
        operation: "update",
        entityId,
        body: bodyValid.value,
        filter,
        entity: emptyEntityRecord,
        created: false,
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
      const filter = filterFromPayload(model, payload);
      if (filter === false) {
        sendJson(res, 400, { error: "invalid filter" });
        return;
      }
      const runId = uuidV7();
      const run: FlowRun<ModelFieldsInput> = {
        id: runId,
        model,
        operation: "delete",
        entityId,
        body: emptyEntityRecord,
        filter,
        entity: emptyEntityRecord,
        created: false,
        results: [],
        signal: Running,
      };
      this.runs.set(runId, run);
      const signal = await executeRun(this.runtimeFor(runId, model, entityId, "delete"), run);
      this.finalizeRun(runId, run, signal);
      sendJson(res, 200, { signal });
      return;
    }
    sendJson(res, 404, { error: "not found" });
  }
}

export type AppInstance = App;

export function app<const E extends readonly ExternalDef[]>(config: AppConfig<E>): App<E> {
  return new App(config);
}
