import { z } from "zod";
import { ModelFieldError } from "../errors.ts";
import { NumericType, PlainType } from "./type.ts";
import type { ScalarTypeDef, TypeMeta } from "./type.ts";

export const UnknownSchemaKind = "__fookie_unknown_schema__";

export type ZodFieldShape = {
  kind: string;
  group: string;
};

const zodInternalsSchema = z.looseObject({
  _zod: z.looseObject({
    def: z.looseObject({
      type: z.string().min(1),
      format: z.string().min(1).optional(),
      checks: z.array(z.looseObject({})).optional(),
    }),
  }),
});

const checkDefSchema = z.looseObject({
  def: z.looseObject({ format: z.string().min(1) }),
});

const checkInternalsSchema = z.looseObject({
  _zod: z.looseObject({
    def: z.looseObject({ format: z.string().min(1) }),
  }),
});

export function schemaTypeOf(candidate: z.ZodType): string {
  const parsed = zodInternalsSchema.safeParse(candidate);
  if (parsed.success === false) {
    return UnknownSchemaKind;
  }
  const typeName = parsed.data._zod.def.type;
  if (typeName.length < 1) {
    return UnknownSchemaKind;
  }
  return typeName;
}

function schemaFormatOf(candidate: z.ZodType): string {
  const parsed = zodInternalsSchema.safeParse(candidate);
  if (parsed.success === false) {
    return UnknownSchemaKind;
  }
  const declaredFormat = z.string().min(1).safeParse(parsed.data._zod.def.format);
  if (declaredFormat.success === true) {
    return declaredFormat.data;
  }
  const checks = z.array(z.looseObject({})).safeParse(parsed.data._zod.def.checks);
  if (checks.success === false) {
    return UnknownSchemaKind;
  }
  for (const check of checks.data) {
    const byDef = checkDefSchema.safeParse(check);
    if (byDef.success === true) {
      return byDef.data.def.format;
    }
    const byInternals = checkInternalsSchema.safeParse(check);
    if (byInternals.success === true) {
      return byInternals.data._zod.def.format;
    }
  }
  return UnknownSchemaKind;
}

export function zodFieldShape(candidate: z.ZodType): ZodFieldShape {
  const typeName = schemaTypeOf(candidate);
  const format = schemaFormatOf(candidate);
  if (typeName === "string") {
    if (format === "uuid") {
      return { kind: "uuid", group: "uuid" };
    }
    return { kind: "text", group: "string" };
  }
  if (typeName === "number") {
    if (format === "safeint" || format === "int32") {
      return { kind: "integer", group: "numeric" };
    }
    return { kind: "doublePrecision", group: "numeric" };
  }
  if (typeName === "boolean") {
    return { kind: "boolean", group: "boolean" };
  }
  if (typeName === "enum") {
    return { kind: "text", group: "string" };
  }
  throw ModelFieldError.create(`zod schema of type ${typeName} has no column mapping`);
}

const declaredMetaSchema = z.looseObject({
  unique: z.boolean().optional(),
  index: z.boolean().optional(),
});

export function zodFieldMetaOf(candidate: z.ZodType, base: TypeMeta): TypeMeta {
  const parsed = declaredMetaSchema.safeParse(candidate.meta());
  if (parsed.success === false) {
    return base;
  }
  return {
    unique: parsed.data.unique === true ? true : base.unique,
    index: parsed.data.index === true ? true : base.index,
    min: base.min,
    max: base.max,
  };
}

function rejectAbsentSchema(candidate: z.ZodType): boolean {
  const typeName = schemaTypeOf(candidate);
  if (typeName === "nullable") {
    throw ModelFieldError.create("model fields cannot be nullable");
  }
  if (typeName === "optional") {
    throw ModelFieldError.create("model fields cannot be optional");
  }
  if (typeName === UnknownSchemaKind) {
    throw ModelFieldError.create("model field schema not recognised");
  }
  return true;
}

export function fieldFromZod(candidate: z.ZodType, base: TypeMeta): ScalarTypeDef {
  rejectAbsentSchema(candidate);
  const shape = zodFieldShape(candidate);
  const fieldMeta = zodFieldMetaOf(candidate, base);
  if (shape.group === "numeric") {
    const numericParsed = z.instanceof(z.ZodNumber).safeParse(candidate);
    if (numericParsed.success === false) {
      throw ModelFieldError.create("numeric field requires a zod number schema");
    }
    return NumericType.create(numericParsed.data, shape.kind, fieldMeta);
  }
  if (shape.group === "boolean") {
    const flagParsed = z.instanceof(z.ZodBoolean).safeParse(candidate);
    if (flagParsed.success === false) {
      throw ModelFieldError.create("boolean field requires a zod boolean schema");
    }
    return PlainType.create(flagParsed.data, shape.kind, "boolean", fieldMeta);
  }
  const uuidParsed = z.instanceof(z.ZodUUID).safeParse(candidate);
  if (uuidParsed.success === true) {
    return PlainType.create(uuidParsed.data, shape.kind, "uuid", fieldMeta);
  }
  const enumParsed = z.instanceof(z.ZodEnum).safeParse(candidate);
  if (enumParsed.success === true) {
    const optionsParsed = z.array(z.string().min(1)).safeParse(enumParsed.data.options);
    if (optionsParsed.success === false) {
      throw ModelFieldError.create("enum field requires string members");
    }
    const allowed = optionsParsed.data;
    const memberSchema = z.string().refine((choice) => allowed.includes(choice));
    return PlainType.create(memberSchema, shape.kind, "string", fieldMeta);
  }
  const stringParsed = z.instanceof(z.ZodString).safeParse(candidate);
  if (stringParsed.success === false) {
    throw ModelFieldError.create("text field requires a zod string schema");
  }
  return PlainType.create(stringParsed.data, shape.kind, "string", fieldMeta);
}
