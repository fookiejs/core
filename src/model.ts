import { z } from "zod";
import type { CreateFlow, DeleteFlow, ListFlow, UpdateFlow } from "./engine/flow.ts";
import { ModelFieldError, ValidationError } from "./errors.ts";
import { buildFilterSchema } from "./filter/schema.ts";
import type { FilterInput } from "./filter/schema.ts";
import type { Signal } from "./signal.ts";
import { appendItem } from "./slot.ts";
import { Types } from "./types/catalog.ts";
import { fieldFromZod } from "./types/from-zod.ts";
import { uuidSchema } from "./types/pg-literals.ts";
import { defaultMeta } from "./types/type.ts";
import type {
  CoordinateTypeDef,
  NumericType,
  NumericTypeDef,
  PlainType,
  PlainTypeDef,
  ScalarSchema,
  Scalar,
  ScalarTypeDef,
  TypeDef,
} from "./types/type.ts";
import {
  copyJsonObject,
  entityRecordFromPlain,
  isEntityValue,
  isPlainRecord,
  jsonWireSchema,
} from "./values.ts";
import type { Coordinate, EntityRecord, FilterGroup, JsonValue } from "./values.ts";

export type ModelRef = {
  name: string;
};

export type FieldSlotKinds = {
  scalar: ScalarTypeDef;
  ref: ModelRef;
  model: ModelDef<ModelFieldsInput>;
};

export type FieldValue = FieldSlotKinds[keyof FieldSlotKinds];

export type FieldsMap = {
  [key: string]: FieldValue;
};

export type ModelFieldKinds = {
  scalar: ScalarTypeDef;
  zod: z.ZodType<Scalar>;
  ref: ModelRef;
};

export function isModelRef(fieldDef: FieldValue): fieldDef is FieldSlotKinds["ref"] {
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

export function isRelationField(
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

export function fieldSchema(fieldDef: FieldValue): ScalarSchema {
  if (isRelationField(fieldDef) === true) {
    return uuidSchema;
  }
  const schema = fieldDef.schema;
  if (z.looseObject({}).safeParse(schema).success === false) {
    throw ModelFieldError.create("field schema required");
  }
  return schema;
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

export type InferTypeDef<D extends ScalarTypeDef> = D extends NumericTypeDef
  ? number
  : D extends CoordinateTypeDef
    ? Coordinate
    : D extends PlainTypeDef<infer T, infer _G>
      ? T
      : never;

export function parseBodyRecord(
  schema: z.ZodObject<z.ZodRawShape>,
  bodyJson: JsonValue,
): EntityRecord {
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

export function parseFilter(
  schema: z.ZodObject<z.ZodRawShape>,
  filterJson: JsonValue,
): FilterInput {
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

export type ModelFieldsInput = Record<string, ModelFieldKinds[keyof ModelFieldKinds]>;

export type SystemFieldKeyKinds = {
  id: "id";
  createdAt: "createdAt";
  updatedAt: "updatedAt";
  isDeleted: "isDeleted";
};

export type SystemFieldKey = SystemFieldKeyKinds[keyof SystemFieldKeyKinds];

export const systemFieldDefs = {
  id: Types.id,
  createdAt: Types.datetime,
  updatedAt: Types.datetime,
  isDeleted: Types.bool,
};

export type SystemFieldsMap = {
  id: TypeDef<string>;
  createdAt: TypeDef<string>;
  updatedAt: TypeDef<string>;
  isDeleted: TypeDef<boolean>;
};

export type NormalizedZodField<V extends z.ZodType<Scalar>> =
  z.infer<V> extends number
    ? NumericType
    : z.infer<V> extends boolean
      ? PlainType<boolean, "boolean">
      : PlainType<string, FilterGroup>;

export type NormalizeModelFields<F extends ModelFieldsInput> = {
  [K in keyof F]: F[K] extends ScalarTypeDef
    ? F[K]
    : F[K] extends z.ZodType<Scalar>
      ? NormalizedZodField<F[K]>
      : ModelRef;
};

export type EntityFieldsOf<D extends ModelFieldsInput> = NormalizeModelFields<D> & SystemFieldsMap;

export type InferCreateBody<D extends ModelFieldsInput> = InferFields<NormalizeModelFields<D>>;

export type ModelEntity<D extends ModelFieldsInput> = InferCreateBody<D> & {
  id: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
};

export function isSystemFieldKey(key: string): key is SystemFieldKey {
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

export function domainFieldsFrom(fields: FieldsMap): FieldsMap {
  const domain: Record<string, FieldValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (isSystemFieldKey(key) === false) {
      domain[key] = value;
    }
  }
  return domain;
}

export function mergeFieldsMaps(left: FieldsMap, right: FieldsMap): FieldsMap {
  const merged: Record<string, FieldValue> = {};
  for (const [key, value] of Object.entries(left)) {
    merged[key] = value;
  }
  for (const [key, value] of Object.entries(right)) {
    merged[key] = value;
  }
  return merged;
}

export function isCreateBody<D extends ModelFieldsInput>(
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

export function isModelEntity<D extends ModelFieldsInput>(
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

export function mergeUpdateBody<D extends ModelFieldsInput>(
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

export function createdEntity(entityId: string, body: EntityRecord): EntityRecord {
  const now = isoNow();
  const entity = copyJsonObject(body);
  entity.id = entityId;
  entity.createdAt = now;
  entity.updatedAt = now;
  entity.isDeleted = false;
  return entityRecordFromPlain(entity);
}

export function isoNow(): string {
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

export function stampUpdate(existing: EntityRecord, domain: EntityRecord): EntityRecord {
  const merged = copyJsonObject(existing);
  for (const [key, value] of Object.entries(domain)) {
    if (isSystemFieldKey(key) === false) {
      merged[key] = value;
    }
  }
  merged.updatedAt = isoNow();
  return entityRecordFromPlain(merged);
}

export function stampSoftDelete(entity: EntityRecord): EntityRecord {
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

export function entityStoreKey(modelName: string, entityId: string): string {
  if (z.string().min(1).safeParse(modelName).success === false) {
    throw ModelFieldError.create("model name required for entity store key");
  }
  if (z.string().min(1).safeParse(entityId).success === false) {
    throw ModelFieldError.create("entity id required for entity store key");
  }
  const key = `${modelName}:${entityId}`;
  return key;
}

export type InferFromField<V> = V extends ScalarTypeDef
  ? InferTypeDef<V>
  : V extends z.ZodType<Scalar>
    ? z.infer<V>
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

export type WritableBody<F extends FieldsMap> = {
  -readonly [K in keyof InferFields<F>]: InferFields<F>[K];
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

export function isZodFieldValue(
  candidate: ModelFieldKinds[keyof ModelFieldKinds],
): candidate is z.ZodType<Scalar> {
  const asZod = z.instanceof(z.ZodType).safeParse(candidate);
  if (asZod.success === false) {
    return false;
  }
  if (z.looseObject({}).safeParse(candidate).success === false) {
    return false;
  }
  return true;
}

export function normalizedFields(fields: ModelFieldsInput): FieldsMap {
  const normalized: Record<string, FieldValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (isZodFieldValue(value) === true) {
      normalized[key] = fieldFromZod(value, defaultMeta());
      continue;
    }
    normalized[key] = value;
  }
  return normalized;
}

export function Model<const F extends ModelFieldsInput>(config: {
  name: string;
  fields: ModelFieldsInput & F;
  flow: FlowHandlers<F>;
}): ModelDef<F> {
  const domainFields = domainFieldsFrom(normalizedFields(config.fields));
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
