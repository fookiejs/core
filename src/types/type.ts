import { z } from "zod";
import { ModelFieldError } from "../errors.ts";
import type { Coordinate, EntityValue, FilterGroup } from "../values.ts";

export type TypeMeta = {
  unique: boolean;
  index: boolean;
  min: number;
  max: number;
};

export type Scalar = EntityValue;

export type ScalarSchema = z.ZodType<Scalar, Scalar>;

export function typeMeta(unique: boolean, index: boolean, min: number, max: number): TypeMeta {
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

export function defaultMeta(): TypeMeta {
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

  private constructor(schema: z.ZodType<T, T>, kind: string, filterGroup: G, meta: TypeMeta) {
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

  static create(schema: z.ZodNumber, kind: string, meta: TypeMeta = defaultMeta()): NumericType {
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

export type PlainTypeDef<T extends Scalar, G extends FilterGroup> = PlainType<T, G>;

export type CoordinateTypeDef = PlainType<Coordinate, "coordinate">;

export type ScalarTypeDefByKind = {
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
