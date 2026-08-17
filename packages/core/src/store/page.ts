import { z } from "zod";
import { ModelFieldError } from "../errors.ts";
import type { ListPage } from "../filter/ops.ts";
import type { ModelDef, ModelFieldsInput } from "../model.ts";
import { isCoordinate } from "../pg/encode.ts";
import { pageBound } from "./query.ts";
import { appendItem } from "../slot.ts";
import { entityValueAt } from "../values.ts";
import type { EntityRecord, EntityValue } from "../values.ts";

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function compareEntityValues(left: EntityValue, right: EntityValue): number {
  const leftNum = z.number().finite().safeParse(left);
  const rightNum = z.number().finite().safeParse(right);
  if (leftNum.success === true && rightNum.success === true) {
    if (leftNum.data < rightNum.data) {
      return -1;
    }
    if (leftNum.data > rightNum.data) {
      return 1;
    }
    return 0;
  }
  const leftFlag = z.boolean().safeParse(left);
  const rightFlag = z.boolean().safeParse(right);
  if (leftFlag.success === true && rightFlag.success === true) {
    if (leftFlag.data === rightFlag.data) {
      return 0;
    }
    if (leftFlag.data === false) {
      return -1;
    }
    return 1;
  }
  if (isCoordinate(left) === true && isCoordinate(right) === true) {
    return 0;
  }
  const leftText = z.string().safeParse(left);
  const rightText = z.string().safeParse(right);
  if (leftText.success === true && rightText.success === true) {
    return compareText(leftText.data, rightText.data);
  }
  return 0;
}

function compareRecords(left: EntityRecord, right: EntityRecord, field: string): number {
  const leftHits = entityValueAt(left, field);
  const rightHits = entityValueAt(right, field);
  if (leftHits.length < 1 || rightHits.length < 1) {
    return 0;
  }
  for (const leftValue of leftHits) {
    for (const rightValue of rightHits) {
      return compareEntityValues(leftValue, rightValue);
    }
  }
  return 0;
}

export function pageEntities(
  model: ModelDef<ModelFieldsInput>,
  rows: readonly EntityRecord[],
  page: ListPage,
): EntityRecord[] {
  if (Array.isArray(page.order) === false) {
    throw ModelFieldError.create("list page order required");
  }
  const ordered = rows.toSorted((left, right) => {
    for (const term of page.order) {
      if (Object.keys(model.fields).includes(term.field) === false) {
        throw ModelFieldError.create("order field unknown");
      }
      const compared = compareRecords(left, right, term.field);
      if (compared === 0) {
        continue;
      }
      if (term.direction === "desc") {
        return 0 - compared;
      }
      return compared;
    }
    return compareRecords(left, right, "id");
  });
  let start = 0;
  for (const offset of page.offset) {
    start = pageBound(offset);
  }
  let sliced: readonly EntityRecord[] = ordered.slice(start);
  for (const limit of page.limit) {
    sliced = sliced.slice(0, pageBound(limit));
  }
  let copied: readonly EntityRecord[] = [];
  for (const row of sliced) {
    copied = appendItem(copied, row);
  }
  return copied.slice();
}
