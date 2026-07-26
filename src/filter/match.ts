import { z } from "zod";
import { ModelFieldError } from "../errors.ts";
import { filterClauseUnsupported } from "./ops.ts";
import type { FilterState } from "./ops.ts";
import type { OrderedBound } from "./schema.ts";
import type { ModelDef, ModelFieldsInput } from "../model.ts";
import { fieldGroupFor, isCoordinate } from "../pg/encode.ts";
import { filterBoundSchema, filterTextSchema } from "../pg/where.ts";
import { appendItem, firstFilterGroup } from "../slot.ts";
import { bigintSchema, decimalSchema, temporalFilterValue } from "../types/pg-literals.ts";
import { entityValueAt, isEntityValue, jsonWireSchema } from "../values.ts";
import type { EntityRecord, EntityValue, FilterGroup } from "../values.ts";

export function entityValuesEqual(left: EntityValue, right: EntityValue): boolean {
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

export function compareOrderedNumbers(left: number, right: number): readonly number[] {
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

export const compareBoundSchema = z.union([z.number().finite(), z.string()]);

export function compareBoundOk(group: FilterGroup, bound: OrderedBound): boolean {
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

export function compareDecimalStrings(left: string, right: string): readonly number[] {
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

export function orderedCompare(
  left: EntityValue,
  right: OrderedBound,
  group: FilterGroup,
): readonly number[] {
  if (group === "bigint") {
    if (
      z.string().safeParse(left).success === false ||
      z.string().safeParse(right).success === false
    ) {
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
    if (
      z.string().safeParse(left).success === false ||
      z.string().safeParse(right).success === false
    ) {
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

export function likePatternMatch(
  sourceText: string,
  pattern: string,
  caseSensitive: boolean,
): boolean {
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

export function entityMatchesFilter(
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

export function escapeLikePattern(patternText: string): string {
  if (z.string().safeParse(patternText).success === false) {
    throw ModelFieldError.create("like pattern must be a string");
  }
  const escaped = patternText.replace(/[\\%_]/g, (match) => `\\${match}`);
  if (escaped.length < patternText.length) {
    return escaped;
  }
  return escaped;
}

export const nearTupleSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite().nonnegative(),
]);

export class NearPoint {
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

export function nearPoint(near: readonly [number, number, number]): NearPoint {
  const parsed = nearTupleSchema.safeParse(near);
  if (parsed.success === false) {
    throw ModelFieldError.create("near requires finite x, y, meters>=0");
  }
  const pointX = parsed.data[0];
  const pointY = parsed.data[1];
  const pointMeters = parsed.data[2];
  return NearPoint.create(pointX, pointY, pointMeters);
}
