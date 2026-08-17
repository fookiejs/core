import { z } from "zod";
import { ModelFieldError, ValidationError } from "../errors.ts";
import { filterCoordinateValue, filterGroupOf, filterNearValue } from "./schema.ts";
import type { FilterFieldInput, FilterInput, OrderedBound } from "./schema.ts";
import type { FieldValue, FieldsMap, ModelRef } from "../model.ts";
import { appendItem } from "../slot.ts";
import { isEntityValue, jsonWireSchema } from "../values.ts";
import type { Coordinate, EntityValue, FilterGroup } from "../values.ts";

export type EqNeOps<V, Self> = {
  eq(value: V): Self;
  ne(value: V): Self;
};

export type CompareExtras<V, Self> = {
  gt(value: V): Self;
  gte(value: V): Self;
  lt(value: V): Self;
  lte(value: V): Self;
};

export type InOps<V, Self> = {
  in(values: readonly V[]): Self;
};

export type StringPatternOps<Self> = {
  like(value: string): Self;
  ilike(value: string): Self;
  startsWith(value: string): Self;
  endsWith(value: string): Self;
};

export interface NumericFieldFilterOps
  extends
    EqNeOps<number, NumericFieldFilterOps>,
    CompareExtras<number, NumericFieldFilterOps>,
    InOps<number, NumericFieldFilterOps> {}

export interface BigintFieldFilterOps
  extends
    EqNeOps<string, BigintFieldFilterOps>,
    CompareExtras<string, BigintFieldFilterOps>,
    InOps<string, BigintFieldFilterOps> {}

export interface DecimalFieldFilterOps
  extends
    EqNeOps<string, DecimalFieldFilterOps>,
    CompareExtras<string, DecimalFieldFilterOps>,
    InOps<string, DecimalFieldFilterOps> {}

export interface StringFieldFilterOps
  extends
    EqNeOps<string, StringFieldFilterOps>,
    CompareExtras<string, StringFieldFilterOps>,
    StringPatternOps<StringFieldFilterOps>,
    InOps<string, StringFieldFilterOps> {}

export interface UuidFieldFilterOps
  extends EqNeOps<string, UuidFieldFilterOps>, InOps<string, UuidFieldFilterOps> {}

export interface BoolFieldFilterOps extends EqNeOps<boolean, BoolFieldFilterOps> {}

export interface TemporalFieldFilterOps
  extends EqNeOps<string, TemporalFieldFilterOps>, CompareExtras<string, TemporalFieldFilterOps> {}

export interface CoordinateFieldFilterOps extends EqNeOps<Coordinate, CoordinateFieldFilterOps> {
  near(x: number, y: number, meters: number): CoordinateFieldFilterOps;
}

export interface JsonFieldFilterOps extends EqNeOps<string, JsonFieldFilterOps> {
  contains(value: string): JsonFieldFilterOps;
}

export interface GeometricFieldFilterOps extends EqNeOps<string, GeometricFieldFilterOps> {}

export interface BinaryFieldFilterOps extends EqNeOps<string, BinaryFieldFilterOps> {}

export type FilterOpsForGroup<G extends FilterGroup> = G extends "numeric"
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

export type FilterOpsForField<V extends FieldValue> = V extends {
  filterGroup: infer G extends FilterGroup;
}
  ? FilterOpsForGroup<G>
  : V extends ModelRef
    ? UuidFieldFilterOps
    : never;

export type FilterFor<F extends FieldsMap> = {
  [K in keyof F]: FilterOpsForField<F[K]>;
};

export type FilterState = FilterInput;

export type RuntimeFilterOps = {
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

export type FilterOpValueKinds = {
  entity: EntityValue;
  number: number;
  text: string;
  list: readonly EntityValue[];
  coordinate: Coordinate;
  near: readonly [number, number, number];
};

export type FilterOpValue = FilterOpValueKinds[keyof FilterOpValueKinds];

export function writeFilterFieldOp(
  field: FilterFieldInput,
  op: string,
  opOperand: FilterOpValue,
): void {
  if (z.string().min(1).safeParse(op).success === false) {
    throw ValidationError.create("filter op required");
  }
  if (z.looseObject({}).safeParse(field).success === false) {
    throw ValidationError.create("filter field required");
  }
  const record: Record<string, FilterOpValue> = field;
  record[op] = opOperand;
}

export function copyFilterOpOperand(opValue: FilterOpValue): FilterOpValue {
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

export function copyFilterField(source: FilterFieldInput): FilterFieldInput {
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

export function filterFieldFromState(state: FilterState, key: string): FilterFieldInput[] {
  let found: readonly FilterFieldInput[] = [];
  for (const [entryKey, entryValue] of Object.entries(state)) {
    if (entryKey === key) {
      found = appendItem(found, entryValue);
      break;
    }
  }
  return found.slice();
}

export function assignFilterOp(
  state: FilterState,
  key: string,
  op: string,
  opOperand: FilterOpValue,
): void {
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

export type FilterOpsConfig = {
  compare: boolean;
  stringPattern: boolean;
  inList: boolean;
  contains: boolean;
  near: boolean;
};

export function buildRuntimeFilterOps(
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

export function filterOpsConfig(
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

export const noFilterOps: FilterOpsConfig = filterOpsConfig(false, false, false, false, false);

export const filterOpsConfigByGroup: Record<FilterGroup, FilterOpsConfig> = {
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

export function filterOpsConfigForGroup(group: FilterGroup): FilterOpsConfig {
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

export const compareBoundShape = z.union([z.number(), z.string()]);

export function filterClauseUnsupported(group: FilterGroup, clause: FilterFieldInput): boolean {
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

export function createFilter<F extends FieldsMap>(_fields: F, state: FilterState): FilterView<F> {
  const view: FilterView<F> = {};
  for (const [key, value] of Object.entries(_fields)) {
    const group = filterGroupOf(value);
    const config = filterOpsConfigForGroup(group);
    view[key] = buildRuntimeFilterOps(state, key, config);
  }
  return view;
}

export function copyFilterState(source: FilterInput): FilterState {
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

export type OrderDirectionKinds = {
  asc: "asc";
  desc: "desc";
};

export type OrderDirection = OrderDirectionKinds[keyof OrderDirectionKinds];

export type OrderTerm = {
  field: string;
  direction: OrderDirection;
};

export type ListPage = {
  limit: readonly number[];
  offset: readonly number[];
  order: readonly OrderTerm[];
};

export function emptyListPage(): ListPage {
  const page: ListPage = { limit: [], offset: [], order: [] };
  if (page.limit.length > 0) {
    throw ValidationError.create("empty page must carry no limit");
  }
  if (page.offset.length > 0) {
    throw ValidationError.create("empty page must carry no offset");
  }
  return page;
}
