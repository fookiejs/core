import { z } from "zod";
import { randomBytes } from "node:crypto";
import http from "node:http";
import pg from "pg";

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

type PlainTypeDef<T extends Scalar, G extends FilterGroup> = {
  readonly schema: ScalarSchema & z.ZodType<T, T>;
  readonly kind: string;
  readonly filterGroup: G;
  readonly meta: TypeMeta;
  unique(): PlainTypeDef<T, G>;
  index(): PlainTypeDef<T, G>;
};

export type NumericTypeDef = {
  readonly schema: ScalarSchema & z.ZodType<number, number>;
  readonly kind: string;
  readonly filterGroup: "numeric";
  readonly meta: TypeMeta;
  unique(): NumericTypeDef;
  index(): NumericTypeDef;
  min(n: number): NumericTypeDef;
  max(n: number): NumericTypeDef;
};

type CoordinateTypeDef = PlainTypeDef<Coordinate, "coordinate">;

export type ScalarTypeDef =
  | NumericTypeDef
  | PlainTypeDef<string, FilterGroup>
  | PlainTypeDef<boolean, "boolean">
  | CoordinateTypeDef;

export type TypeDef<T extends Scalar = Scalar> = T extends number
  ? NumericTypeDef
  : T extends Coordinate
    ? CoordinateTypeDef
    : T extends boolean
      ? PlainTypeDef<boolean, "boolean">
      : PlainTypeDef<string, FilterGroup>;

const defaultMeta = (): TypeMeta => ({
  unique: false,
  index: false,
  min: -1,
  max: -1,
});

function createPlainType<T extends Scalar, G extends FilterGroup>(
  schema: z.ZodType<T, T>,
  kind: string,
  filterGroup: G,
  meta: TypeMeta = defaultMeta(),
): PlainTypeDef<T, G> {
  return {
    schema,
    kind,
    filterGroup,
    meta,
    unique() {
      return createPlainType(schema, kind, filterGroup, { ...meta, unique: true });
    },
    index() {
      return createPlainType(schema, kind, filterGroup, { ...meta, index: true });
    },
  };
}

function createNumericType(
  schema: z.ZodNumber,
  kind: string,
  meta: TypeMeta = defaultMeta(),
): NumericTypeDef {
  return {
    schema,
    kind,
    filterGroup: "numeric",
    meta,
    unique() {
      return createNumericType(schema, kind, { ...meta, unique: true });
    },
    index() {
      return createNumericType(schema, kind, { ...meta, index: true });
    },
    min(n: number) {
      return createNumericType(schema.min(n), kind, { ...meta, min: n });
    },
    max(n: number) {
      return createNumericType(schema.max(n), kind, { ...meta, max: n });
    },
  };
}

function coordinateZodSchema(): z.ZodType<Coordinate, Coordinate> {
  return z.tuple([z.number(), z.number()]);
}

const coordinateSchema = coordinateZodSchema();

function createCoordinateType(kind: string, meta: TypeMeta = defaultMeta()): CoordinateTypeDef {
  return createPlainType(coordinateSchema, kind, "coordinate", meta);
}

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
  smallint: createNumericType(z.number().int().min(-32768).max(32767), "smallint"),
  integer: createNumericType(z.number().int(), "integer"),
  int: createNumericType(z.number().int(), "integer"),
  bigint: createPlainType(bigintSchema, "bigint", "bigint"),
  numeric: createPlainType(decimalSchema, "numeric", "decimal"),
  real: createNumericType(z.number(), "real"),
  float: createNumericType(z.number(), "real"),
  doublePrecision: createNumericType(z.number(), "doublePrecision"),
  serial: createNumericType(z.number().int().positive(), "serial"),
  bigserial: createPlainType(bigintSchema, "bigserial", "bigint"),
  text: createPlainType(z.string(), "text", "string"),
  string: createPlainType(z.string(), "text", "string"),
  varchar: (length: number) =>
    createPlainType(z.string().max(length), `varchar(${length})`, "string"),
  char: (length: number) => createPlainType(z.string().length(length), `char(${length})`, "string"),
  boolean: createPlainType(z.boolean(), "boolean", "boolean"),
  bool: createPlainType(z.boolean(), "boolean", "boolean"),
  uuid: createPlainType(uuidSchema, "uuid", "uuid"),
  id: createPlainType(uuidSchema, "id", "uuid"),
  date: createPlainType(dateSchema, "date", "temporal"),
  time: createPlainType(timeSchema, "time", "temporal"),
  timetz: createPlainType(timetzSchema, "timetz", "temporal"),
  timestamp: createPlainType(z.iso.datetime(), "timestamp", "temporal"),
  timestamptz: createPlainType(z.iso.datetime(), "timestamptz", "temporal"),
  datetime: createPlainType(z.iso.datetime(), "timestamp", "temporal"),
  interval: createPlainType(intervalSchema, "interval", "temporal"),
  json: createPlainType(jsonSchema, "json", "json"),
  jsonb: createPlainType(jsonSchema, "jsonb", "json"),
  bytea: createPlainType(byteaSchema, "bytea", "binary"),
  inet: createPlainType(inetSchema, "inet", "string"),
  cidr: createPlainType(cidrSchema, "cidr", "string"),
  macaddr: createPlainType(macaddrSchema, "macaddr", "string"),
  money: createNumericType(z.number(), "money"),
  currency: createNumericType(z.number().nonnegative(), "currency"),
  point: createCoordinateType("point"),
  coordinate: createCoordinateType("point"),
  line: createPlainType(geometricSchema, "line", "geometric"),
  lseg: createPlainType(geometricSchema, "lseg", "geometric"),
  box: createPlainType(geometricSchema, "box", "geometric"),
  path: createPlainType(geometricSchema, "path", "geometric"),
  polygon: createPlainType(geometricSchema, "polygon", "geometric"),
  circle: createPlainType(geometricSchema, "circle", "geometric"),
  xml: createPlainType(z.string(), "xml", "string"),
  email: createPlainType(z.string().email(), "email", "string"),
  url: createPlainType(z.string().url(), "url", "string"),
  enum<T extends readonly [string, ...string[]]>(...values: T): PlainTypeDef<string, "string"> {
    return createPlainType(z.enum(values), "enum", "string");
  },
  relation<T extends { name: string }>(model: T) {
    return createPlainType(uuidSchema, `relation:${model.name}`, "uuid");
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

function parseBodyRecord(
  schema: z.ZodObject<z.ZodRawShape>,
  value: EntityRecord,
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
  value: FilterInput,
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
};

const outboxTableName = "fookie_outbox";

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

async function ensureModelTable(
  db: PgQueryable,
  model: ModelDef<ModelFieldsInput>,
  errorBox: DbErrorBox,
): Promise<boolean> {
  const table = tableNameFor(model.name);
  const columns: string[] = [];
  for (const [key, field] of Object.entries(model.fields)) {
    const col = columnNameFor(key);
    const type = pgColumnType(field);
    const notNull =
      key === "id" || key === "createdAt" || key === "updatedAt" || key === "isDeleted";
    columns.push(`${col} ${type}${notNull ? " NOT NULL" : ""}`);
  }
  const sql = `CREATE TABLE IF NOT EXISTS ${table} (${columns.join(", ")}, PRIMARY KEY (id))`;
  try {
    await db.query(sql);
    for (const [key, field] of Object.entries(model.fields)) {
      if (!isRelationField(field) && field.meta.unique) {
        const col = columnNameFor(key);
        await db.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_${col}_uidx ON ${table} (${col})`,
        );
      }
      if (!isRelationField(field) && field.meta.index && !field.meta.unique) {
        const col = columnNameFor(key);
        await db.query(`CREATE INDEX IF NOT EXISTS ${table}_${col}_idx ON ${table} (${col})`);
      }
    }
    return true;
  } catch (err) {
    captureDbError(err, errorBox);
    return false;
  }
}

async function ensureOutboxTable(db: PgQueryable, errorBox: DbErrorBox): Promise<boolean> {
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
    await db.query(sql);
    await db.query(
      `ALTER TABLE ${outboxTableName} ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1`,
    );
    return true;
  } catch (err) {
    captureDbError(err, errorBox);
    return false;
  }
}

async function ensureAllTables(
  db: PgQueryable,
  models: ReadonlyArray<ModelDef<ModelFieldsInput>>,
  errorBox: DbErrorBox,
): Promise<boolean> {
  for (const model of models) {
    const ok = await ensureModelTable(db, model, errorBox);
    if (!ok) {
      return false;
    }
  }
  return await ensureOutboxTable(db, errorBox);
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
      params.push(`${clause.startsWith}%`);
      index += 1;
    }
    if (clause.endsWith !== undefined) {
      parts.push(`${col} LIKE $${index}`);
      params.push(`%${clause.endsWith}`);
      index += 1;
    }
    if (clause.contains !== undefined && group === "json") {
      parts.push(`${col}::text ILIKE $${index}`);
      params.push(`%${clause.contains}%`);
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
      parts.push(`point(${col}) <@ circle(point '(${point.x},${point.y})', ${point.meters})`);
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

async function upsertEntity(
  db: PgQueryable,
  model: ModelDef<ModelFieldsInput>,
  entity: EntityRecord,
): Promise<boolean> {
  const table = tableNameFor(model.name);
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
    await db.query(sql, values);
    return true;
  } catch {
    return false;
  }
}

async function loadEntityFromDb(
  db: PgQueryable,
  model: ModelDef<ModelFieldsInput>,
  entityId: string,
): Promise<EntityRecord | false> {
  const table = tableNameFor(model.name);
  const sql = `SELECT * FROM ${table} WHERE id = $1 AND is_deleted = false`;
  try {
    const result = await db.query(sql, [entityId]);
    if (result.rowCount === 0) {
      return false;
    }
    const row = pgRowCells(result.rows[0]);
    return rowToEntity(model, row);
  } catch {
    return false;
  }
}

async function queryEntities(
  db: PgQueryable,
  model: ModelDef<ModelFieldsInput>,
  filter: FilterState,
): Promise<EntityRecord[]> {
  const table = tableNameFor(model.name);
  const where = buildWhereClause(model, filter);
  const sql = `SELECT * FROM ${table} WHERE ${where.sql}`;
  try {
    const result = await db.query(sql, where.params);
    const rows = result.rows.map((row) => rowToEntity(model, pgRowCells(row)));
    return rows;
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
  const cached = rt.entities.get(key);
  if (cached && cached.id === entityId) {
    return cached;
  }
  const fromDb = await loadEntityFromDb(rt.db, model, entityId);
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
  rt.entities.set(entityStoreKey(model.name, entityId), entity);
  return upsertEntity(rt.db, model, entity);
}

function isExternalInput<I extends Record<string, ScalarTypeDef>>(
  fields: I,
  value: EntityRecord,
): value is InferExternalInputFrom<I> {
  return externalFieldsSchema(fields).safeParse(value).success;
}

function parseExternalInput<I extends Record<string, ScalarTypeDef>>(
  fields: I,
  value: EntityRecord,
): ParseResult<InferExternalInputFrom<I>> {
  if (!isExternalInput(fields, value)) {
    return { ok: false, signal: Failed };
  }
  return { ok: true, value };
}

function isExternalOutput<O extends Record<string, ScalarTypeDef>>(
  fields: O,
  value: EntityRecord,
): value is InferExternalOutputFrom<O> {
  return externalFieldsSchema(fields).safeParse(value).success;
}

function parseExternalOutput<O extends Record<string, ScalarTypeDef>>(
  fields: O,
  value: EntityRecord,
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
  validateCreateBody: (body: EntityRecord) => ParseResult<EntityRecord>;
  validateUpdateBody: (body: EntityRecord) => ParseResult<EntityRecord>;
  validateListFilter: (filter: FilterInput) => ParseResult<FilterInput>;
  validateUpdateFilter: (filter: FilterInput) => ParseResult<FilterInput>;
  validateDeleteFilter: (filter: FilterInput) => ParseResult<FilterInput>;
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
    validateCreateBody: (body) => parseBodyRecord(partialFieldsSchema(domainFields), body),
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
  validateInput(value: EntityRecord): ParseResult<InferExternalInputFrom<I>>;
  validateOutput(value: EntityRecord): ParseResult<InferExternalOutputFrom<O>>;
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

type Runtime<E extends readonly ExternalDef[] = readonly ExternalDef[]> = {
  traceId: string;
  model: ModelDef<ModelFieldsInput>;
  entityId: string;
  operation: string;
  logs: LogEntry[];
  metrics: MetricEntry[];
  spans: SpanEntry[];
  outbox: Map<string, OutboxEntry>;
  onExternalEvent: (event: ExternalEventOf<E[number]>) => Promise<void>;
  models: ReadonlyArray<ModelDef<ModelFieldsInput>>;
  externals: E;
  resume: (runId: string) => Promise<Signal>;
  entities: Map<string, EntityRecord>;
  pool: InjectablePool;
  db: PgQueryable;
  awaitDb: () => Promise<boolean>;
  reportDbError: (message: string) => void;
  dbLastError: () => string;
  listResults: EntityRecord[];
  pendingExternalEvents: PendingExternalEvent[];
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

function entityRecordFromJson(raw: unknown): EntityRecord | false {
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

async function loadOutboxFromDb(
  db: PgQueryable,
  outbox: Map<string, OutboxEntry>,
  errorBox: DbErrorBox,
): Promise<boolean> {
  const sql = `SELECT external_id, name, status, input, output, entity_id, model, run_id, attempt FROM ${outboxTableName}`;
  try {
    const result = await db.query(sql);
    for (const row of result.rows) {
      const externalId = pgCellToString(row.external_id);
      const name = pgCellToString(row.name);
      const statusRaw = pgCellToString(row.status);
      const entityId = pgCellToString(row.entity_id);
      const model = pgCellToString(row.model);
      const runId = pgCellToString(row.run_id);
      const attemptRaw = row.attempt;
      const attempt =
        typeof attemptRaw === "number" ? attemptRaw : Number(pgCellToString(attemptRaw));
      const input = entityRecordFromJson(row.input);
      if (!isOutboxStatus(statusRaw) || input === false || attempt < 1) {
        continue;
      }
      const base = {
        externalId,
        name,
        entityId,
        model,
        runId,
        attempt,
        input,
      };
      if (statusRaw === "pending") {
        outbox.set(externalId, { ...base, status: "pending" });
        continue;
      }
      if (statusRaw === "failed") {
        outbox.set(externalId, { ...base, status: "failed" });
        continue;
      }
      const output = entityRecordFromJson(row.output);
      if (output === false) {
        continue;
      }
      outbox.set(externalId, { ...base, status: "completed", output });
    }
    return true;
  } catch (err) {
    captureDbError(err, errorBox);
    return false;
  }
}

async function saveOutboxEntry(db: PgQueryable, entry: OutboxEntry): Promise<boolean> {
  const output = entry.status === "completed" ? JSON.stringify(entry.output) : null;
  const sql = `INSERT INTO ${outboxTableName} (external_id, name, status, input, output, entity_id, model, run_id, attempt)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9)
    ON CONFLICT (external_id) DO UPDATE SET status = EXCLUDED.status, output = EXCLUDED.output, attempt = EXCLUDED.attempt`;
  try {
    await db.query(sql, [
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

function pushFrameworkMetric(rt: Runtime, name: string, value: number = 1): void {
  rt.metrics.push({
    name: `${rt.model.name.toLowerCase()}.${name}`,
    value,
    traceId: rt.traceId,
    model: rt.model.name,
    timestamp: new Date().toISOString(),
  });
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

function appendLog(rt: Runtime, entry: LogEntry): void {
  rt.logs.push(entry);
  process.stdout.write(`${logLineFromEntry(entry)}\n`);
}

function pushFrameworkLog(
  rt: Runtime,
  message: string,
  fields: Record<string, LogFieldValue>,
): void {
  appendLog(rt, {
    level: "error",
    message,
    traceId: rt.traceId,
    model: rt.model.name,
    entityId: rt.entityId,
    operation: rt.operation,
    timestamp: new Date().toISOString(),
    fields,
  });
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

async function dispatchExternalEvent(
  rt: Runtime,
  ext: ExternalDef,
  externalId: string,
  input: EntityRecord,
): Promise<void> {
  if (rt.db === rt.pool) {
    await emitExternalHandler(rt.onExternalEvent, ext, externalId, input);
    return;
  }
  rt.pendingExternalEvents.push({ externalId, name: ext.name, input });
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
    const txRt: Runtime = { ...rt, db: client };
    const signal = await run(txRt);
    if (signal === Failed) {
      txRt.pendingExternalEvents.length = 0;
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
      await flushPendingExternalEvents(txRt);
    }
    return signal;
  } catch {
    try {
      rt.pendingExternalEvents.length = 0;
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

function mergeObservability(rt: Runtime, localRt: Runtime) {
  rt.logs.push(...localRt.logs);
  rt.metrics.push(...localRt.metrics);
  rt.spans.push(...localRt.spans);
}

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
  return `${entityId}:${name}:${JSON.stringify(input)}`;
}

function createObservability(rt: Runtime) {
  return {
    log(message: string, fields: Record<string, LogFieldValue>) {
      appendLog(rt, {
        level: "info",
        message,
        traceId: rt.traceId,
        model: rt.model.name,
        entityId: rt.entityId,
        operation: rt.operation,
        timestamp: new Date().toISOString(),
        fields,
      });
      return true;
    },
    increment(name: string) {
      pushFrameworkMetric(rt, name);
      return true;
    },
    histogram(name: string, value: number) {
      pushFrameworkMetric(rt, name, value);
      return true;
    },
  };
}

async function traceSpan<T>(rt: Runtime, name: string, run: () => Promise<T>): Promise<T> {
  const startedAt = new Date().toISOString();
  const result = await run();
  rt.spans.push({
    name,
    traceId: rt.traceId,
    model: rt.model.name,
    entityId: rt.entityId,
    operation: rt.operation,
    startedAt,
    endedAt: new Date().toISOString(),
  });
  return result;
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
  const existing = rt.outbox.get(id);

  if (existing && existing.status === "completed") {
    const outputValid = parseExternalOutput(ext.output, existing.output);
    if (!outputValid.ok) {
      return { signal: Failed };
    }
    return {
      output: outputValid.value,
      signal: Done,
    };
  }

  if (existing && existing.status === "failed") {
    return { signal: Failed };
  }

  if (!existing) {
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
    await saveOutboxEntry(rt.db, pending);
    pushFrameworkMetric(rt, "external.dispatched");
    await dispatchExternalEvent(rt, ext, id, validated.value);
    return { signal: Running };
  }

  return { signal: Running };
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

  const signal = await model.flow.create(flow);
  mergeObservability(rt, localRt);
  pushFrameworkMetric(localRt, "nested.create");

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

  const signal = await model.flow.list(flow);
  mergeObservability(rt, localRt);
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

  const signal = await model.flow.update(flow);
  mergeObservability(rt, localRt);
  if (signal === Done) {
    const existing = await getEntity(rt, model, input.id);
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

  const signal = await model.flow.delete(flow);
  mergeObservability(rt, localRt);
  if (signal === Done) {
    const existing = await getEntity(rt, model, input.id);
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
  pushFrameworkMetric(rt, "operation.failed");
  pushFrameworkLog(rt, "database unavailable", { reason });
}

async function executeRun<D extends ModelFieldsInput>(
  rt: Runtime,
  run: FlowRun<D>,
): Promise<Signal> {
  const metricRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
  const dbOk = await rt.awaitDb();
  if (!dbOk) {
    reportDatabaseFailure(metricRt);
    return Failed;
  }
  const startedAt = Date.now();
  pushFrameworkMetric(metricRt, "operation.started");
  let signal: Signal = Failed;

  if (run.operation === "list") {
    const validated = run.model.validateListFilter(run.filter);
    if (!validated.ok) {
      pushFrameworkMetric(metricRt, "operation.duration", Date.now() - startedAt);
      pushFrameworkMetric(metricRt, "operation.failed");
      return Failed;
    }
    const localRt = scopedRuntime(rt, run.model, run.entityId, run.operation);
    const obs = createObservability(localRt);
    const filterState: FilterState = { ...validated.value };
    const rows = await queryEntities(rt.db, run.model, filterState);
    rt.listResults.splice(0, rt.listResults.length, ...rows);
    const flow: ListFlow<EntityFieldsOf<D>> = {
      filter: createFilter(run.model.fields, filterState),
      ...createFlowModelOps(localRt, run.model, run.entityId, obs),
    };
    signal = await run.model.flow.list(flow);
  } else {
    signal = await withWriteTransaction(rt, (txRt) => executeRunMutation(txRt, run));
    if (signal === Failed) {
      pushFrameworkMetric(metricRt, "saga.compensate");
    }
  }

  pushFrameworkMetric(metricRt, "operation.duration", Date.now() - startedAt);
  if (signal === Done) {
    pushFrameworkMetric(metricRt, "operation.completed");
  } else if (signal === Failed) {
    pushFrameworkMetric(metricRt, "operation.failed");
  } else {
    pushFrameworkMetric(metricRt, "operation.suspended");
  }
  return signal;
}

type AppState<E extends readonly ExternalDef[] = readonly ExternalDef[]> = {
  listen: string;
  database: string;
  models: ReadonlyArray<ModelDef<ModelFieldsInput>>;
  externals: E;
  onExternalEvent: (event: ExternalEventOf<E[number]>) => Promise<void>;
  runs: Map<string, FlowRun<ModelFieldsInput>>;
  outbox: Map<string, OutboxEntry>;
  entities: Map<string, EntityRecord>;
  logs: LogEntry[];
  metrics: MetricEntry[];
  spans: SpanEntry[];
  listResults: EntityRecord[];
  pool: InjectablePool;
  dbReady: boolean;
  dbLastError: string;
  server: http.Server | false;
  pendingExternalEvents: PendingExternalEvent[];
};

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

type HttpPayload = Record<string, string | number | boolean | Record<string, unknown>>;

function filterFieldFromRecord(raw: Record<string, unknown>): FilterFieldInput {
  const clause: FilterFieldInput = {};
  for (const [op, opVal] of Object.entries(raw)) {
    if (op === "in" && Array.isArray(opVal)) {
      const items: EntityValue[] = [];
      for (const item of opVal) {
        if (isEntityValue(item)) {
          items.push(item);
        }
      }
      if (items.length > 0) {
        clause.in = items;
      }
      continue;
    }
    if (op === "eq" || op === "ne") {
      if (isEntityValue(opVal)) {
        if (op === "eq") {
          clause.eq = opVal;
        } else {
          clause.ne = opVal;
        }
      }
      continue;
    }
    if (op === "gt" || op === "gte" || op === "lt" || op === "lte") {
      if (typeof opVal === "number" || typeof opVal === "string") {
        clause[op] = opVal;
      }
      continue;
    }
    if (op === "like" || op === "ilike" || op === "contains") {
      if (typeof opVal === "string") {
        clause[op] = opVal;
      }
      continue;
    }
    if (op === "startsWith" || op === "endsWith") {
      if (typeof opVal === "string") {
        clause[op] = opVal;
      }
      continue;
    }
    if (op === "near" && Array.isArray(opVal) && opVal.length >= 2) {
      const x = opVal[0];
      const y = opVal[1];
      const m = opVal[2];
      if (typeof x === "number" && typeof y === "number") {
        if (opVal.length > 2 && typeof m === "number") {
          clause.near = [x, y, m];
        } else {
          clause.near = [x, y];
        }
      }
    }
  }
  return clause;
}

function filterInputFromRecord(raw: Record<string, unknown>): FilterInput {
  const filter: FilterInput = {};
  for (const [key, value] of Object.entries(raw)) {
    if (isPlainRecord(value)) {
      filter[key] = filterFieldFromRecord(value);
    }
  }
  return filter;
}

function readJsonBody(req: http.IncomingMessage): Promise<HttpPayload | false> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!isPlainRecord(parsed)) {
          resolve(false);
          return;
        }
        const payload: HttpPayload = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean" ||
            isPlainRecord(value)
          ) {
            payload[key] = value;
          }
        }
        resolve(payload);
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

function recordFromPayload(payload: HttpPayload, key: string): EntityRecord {
  const raw = payload[key];
  if (!isPlainRecord(raw)) {
    return emptyEntityRecord;
  }
  return entityRecordFromPlain(raw);
}

function filterFromPayload(
  model: ModelDef<ModelFieldsInput>,
  payload: HttpPayload,
): FilterInput | false {
  const raw = payload.filter;
  if (!isPlainRecord(raw)) {
    return emptyFilterInput;
  }
  const filter = filterInputFromRecord(raw);
  const validated = model.validateListFilter(filter);
  if (!validated.ok) {
    return false;
  }
  return validated.value;
}

async function handleHttp<E extends readonly ExternalDef[]>(
  state: AppState<E>,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
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
    const ok = await setExternalResultForState(state, { externalId, output });
    sendJson(res, ok ? 200 : 400, { ok });
    return;
  }
  if (parts.length < 2) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const model = resolveModelByName(state.models, parts[0] ?? "");
  if (model === false) {
    sendJson(res, 404, { error: "model not found" });
    return;
  }
  const action = parts[1];
  if (action === "create") {
    const body = recordFromPayload(payload, "body");
    const validated = model.validateCreateBody(body);
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
      signal: Running,
    };
    state.runs.set(runId, run);
    const signal = await executeRun(buildRuntime(state, runId, model, entityId, "create"), run);
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
      signal: Running,
    };
    state.runs.set(runId, run);
    const signal = await executeRun(buildRuntime(state, runId, model, entityId, "list"), run);
    sendJson(res, 200, { signal, results: state.listResults });
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
    const body = recordFromPayload(payload, "body");
    const filter = filterFromPayload(model, payload);
    if (filter === false) {
      sendJson(res, 400, { error: "invalid filter" });
      return;
    }
    const bodyValid = model.validateUpdateBody(body);
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
      signal: Running,
    };
    state.runs.set(runId, run);
    const signal = await executeRun(buildRuntime(state, runId, model, entityId, "update"), run);
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
      signal: Running,
    };
    state.runs.set(runId, run);
    const signal = await executeRun(buildRuntime(state, runId, model, entityId, "delete"), run);
    sendJson(res, 200, { signal });
    return;
  }
  sendJson(res, 404, { error: "not found" });
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

async function recordOutboxEntry<E extends readonly ExternalDef[]>(
  state: AppState<E>,
  entry: OutboxEntry,
): Promise<void> {
  state.outbox.set(entry.externalId, entry);
  await saveOutboxEntry(state.pool, entry);
}

async function setExternalResultForState<E extends readonly ExternalDef[]>(
  state: AppState<E>,
  result: { externalId: string; output: EntityRecord },
): Promise<boolean> {
  const entry = state.outbox.get(result.externalId);
  if (!entry) {
    return false;
  }
  const ext = resolveExternalByName(state.externals, entry.name);
  if (ext === false) {
    return false;
  }
  const run = state.runs.get(entry.runId);
  const resolvedModel = resolveModelByName(state.models, entry.model);
  const metricModel = resolvedModel !== false ? resolvedModel : (run?.model ?? state.models[0]);
  if (metricModel === undefined) {
    return false;
  }
  const metricRt = buildRuntime(
    state,
    entry.runId,
    metricModel,
    entry.entityId,
    run?.operation ?? "create",
  );
  const validated = ext.validateOutput(result.output);
  if (!validated.ok) {
    if (entry.attempt < ext.attempts) {
      const nextAttempt = entry.attempt + 1;
      pushFrameworkMetric(metricRt, "external.retry");
      await recordOutboxEntry(state, {
        ...outboxEntryBase(entry),
        attempt: nextAttempt,
        status: "pending",
      });
      await sleep(backoffDelayMs(ext.backoff, nextAttempt));
      await emitExternalHandler(state.onExternalEvent, ext, entry.externalId, entry.input);
      return false;
    }
    pushFrameworkMetric(metricRt, "external.failed");
    await recordOutboxEntry(state, { ...outboxEntryBase(entry), status: "failed" });
    return false;
  }
  pushFrameworkMetric(metricRt, "external.completed");
  await recordOutboxEntry(state, {
    ...outboxEntryBase(entry),
    status: "completed",
    output: validated.value,
  });
  const resumeModel = run?.model ?? resolvedModel;
  if (resumeModel === false) {
    return true;
  }
  const rt = buildRuntime(
    state,
    entry.runId,
    resumeModel,
    run ? run.entityId : entry.entityId,
    run ? run.operation : "create",
  );
  await rt.resume(entry.runId);
  return true;
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

export type AppInstance = {
  run: () => boolean;
  create: <D extends ModelFieldsInput>(
    model: ModelDef<D>,
    body: InferCreateBody<D>,
  ) => Promise<CreateResult<ModelEntity<D>>>;
  list: <D extends ModelFieldsInput>(model: ModelDef<D>, filter: FilterInput) => Promise<Signal>;
  update: <D extends ModelFieldsInput>(
    model: ModelDef<D>,
    input: { id: string; body: UpdateBody<EntityFieldsOf<D>>; filter: FilterInput },
  ) => Promise<Signal>;
  delete: <D extends ModelFieldsInput>(
    model: ModelDef<D>,
    input: { id: string; filter: FilterInput },
  ) => Promise<Signal>;
  setExternalResult: <O extends Record<string, ScalarTypeDef>>(result: {
    externalId: string;
    output: InferExternalOutputFrom<O>;
  }) => Promise<boolean>;
  resume: (runId: string) => Promise<Signal>;
  patchOutbox: (externalId: string, output: EntityRecord) => boolean;
  listResults: () => EntityRecord[];
  logs: () => LogEntry[];
  metrics: () => MetricEntry[];
  spans: () => SpanEntry[];
};

function buildRuntime<E extends readonly ExternalDef[]>(
  state: AppState<E>,
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
    logs: state.logs,
    metrics: state.metrics,
    spans: state.spans,
    outbox: state.outbox,
    onExternalEvent: state.onExternalEvent,
    models: state.models,
    externals: state.externals,
    entities: state.entities,
    pool: state.pool,
    db: state.pool,
    listResults: state.listResults,
    pendingExternalEvents: state.pendingExternalEvents,
    reportDbError: (message: string) => {
      state.dbLastError = message;
    },
    dbLastError: () => state.dbLastError,
    awaitDb: async () => {
      if (state.dbReady) {
        return true;
      }
      const errorBox: DbErrorBox = { message: "" };
      const tablesOk = await ensureAllTables(state.pool, state.models, errorBox);
      if (!tablesOk) {
        state.dbLastError = errorBox.message.length > 0 ? errorBox.message : "database unavailable";
        return false;
      }
      const outboxOk = await loadOutboxFromDb(state.pool, state.outbox, errorBox);
      if (!outboxOk) {
        state.dbLastError = errorBox.message.length > 0 ? errorBox.message : "database unavailable";
        return false;
      }
      state.dbReady = true;
      return true;
    },
    resume: async (runId) => {
      const run = state.runs.get(runId);
      if (!run) {
        return Failed;
      }
      return executeRun(buildRuntime(state, runId, run.model, run.entityId, run.operation), run);
    },
  };
}

export function app<const E extends readonly ExternalDef[]>(config: {
  listen: string;
  database: string;
  models: readonly RegisteredModel[];
  externals: E;
  onExternalEvent: (event: ExternalEventOf<E[number]>) => Promise<void>;
  pool?: InjectablePool;
}): AppInstance {
  const pool = config.pool ?? new pg.Pool({ connectionString: config.database });
  const state: AppState<E> = {
    listen: config.listen,
    database: config.database,
    models: config.models,
    externals: config.externals,
    onExternalEvent: config.onExternalEvent,
    runs: new Map(),
    outbox: new Map(),
    entities: new Map(),
    logs: [],
    metrics: [],
    spans: [],
    pool,
    dbReady: false,
    dbLastError: "",
    listResults: [],
    server: false,
    pendingExternalEvents: [],
  };

  return {
    run() {
      if (state.server !== false) {
        return true;
      }
      const port = Number(state.listen);
      const server = http.createServer((req, res) => {
        handleHttp(state, req, res).catch(() => {
          sendJson(res, 500, { error: "internal error" });
        });
      });
      server.listen(port);
      state.server = server;
      return true;
    },
    create<D extends ModelFieldsInput>(model: ModelDef<D>, body: InferCreateBody<D>) {
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
        signal: Running,
      };
      state.runs.set(runId, run);
      return executeRun(buildRuntime(state, runId, model, entityId, "create"), run).then(
        (signal): CreateResult<ModelEntity<D>> => {
          if (signal === Done && run.created !== false) {
            return { signal: Done, id: entityId, entity: run.created };
          }
          if (signal === Running) {
            return { signal: Running, runId };
          }
          return { signal: Failed };
        },
      );
    },
    resume(runId) {
      const run = state.runs.get(runId);
      if (!run) {
        return Promise.resolve(Failed);
      }
      return executeRun(buildRuntime(state, runId, run.model, run.entityId, run.operation), run);
    },
    list<D extends ModelFieldsInput>(model: ModelDef<D>, filter: FilterInput) {
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
        signal: Running,
      };
      state.runs.set(runId, run);
      return executeRun(buildRuntime(state, runId, model, entityId, "list"), run);
    },
    update<D extends ModelFieldsInput>(
      model: ModelDef<D>,
      input: { id: string; body: UpdateBody<EntityFieldsOf<D>>; filter: FilterInput },
    ) {
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
        signal: Running,
      };
      state.runs.set(runId, run);
      return executeRun(buildRuntime(state, runId, model, input.id, "update"), run);
    },
    delete<D extends ModelFieldsInput>(
      model: ModelDef<D>,
      input: { id: string; filter: FilterInput },
    ) {
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
        signal: Running,
      };
      state.runs.set(runId, run);
      return executeRun(buildRuntime(state, runId, model, input.id, "delete"), run);
    },
    async setExternalResult(result) {
      return setExternalResultForState(state, result);
    },
    patchOutbox(externalId, output) {
      const entry = state.outbox.get(externalId);
      if (!entry) {
        return false;
      }
      state.outbox.set(externalId, {
        ...entry,
        status: "completed",
        output,
      });
      return true;
    },
    logs: () => state.logs,
    metrics: () => state.metrics,
    spans: () => state.spans,
    listResults: () => state.listResults,
  };
}
