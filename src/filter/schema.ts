import { z } from "zod";
import { ModelFieldError, ValidationError } from "../errors.ts";
import { isRelationField } from "../model.ts";
import type { FieldValue, FieldsMap } from "../model.ts";
import {
  bigintSchema,
  byteaSchema,
  decimalSchema,
  geometricValueSchema,
  jsonSchema,
  temporalFilterValue,
} from "../types/pg-literals.ts";
import type { EntityValue, FilterGroup } from "../values.ts";

export type OrderedBoundKinds = {
  number: number;
  text: string;
};

export type OrderedBound = OrderedBoundKinds[keyof OrderedBoundKinds];

export type FilterOpBag = {
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

export const filterCoordinateValue = z.tuple([z.number().finite(), z.number().finite()]);

export const filterNearValue = z.tuple([
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

export function buildFilterSchema(fields: FieldsMap): z.ZodObject<z.ZodRawShape> {
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

export function filterGroupOf(fieldDef: FieldValue): FilterGroup {
  if (isRelationField(fieldDef) === true) {
    return "uuid";
  }
  const group = fieldDef.filterGroup;
  if (z.string().min(1).safeParse(group).success === false) {
    throw ModelFieldError.create("filter group required");
  }
  return group;
}
