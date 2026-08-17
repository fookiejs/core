import { z } from "zod";
import { ValidationError } from "./errors.ts";
import { firstPresent } from "./slot.ts";
import { copyJsonObject, entityRecordFromPlain, entityValueAt } from "./values.ts";
import type { EntityRecord, JsonObject } from "./values.ts";

export const numericPatchSchema = z.union([
  z.object({ add: z.number().finite() }).strict(),
  z.object({ sub: z.number().finite() }).strict(),
  z.object({ mul: z.number().finite() }).strict(),
  z.object({ div: z.number().finite() }).strict(),
]);

export type NumericPatch = z.infer<typeof numericPatchSchema>;

export function isNumericPatch(value: unknown): value is NumericPatch {
  return numericPatchSchema.safeParse(value).success;
}

function finiteNumber(n: number): number {
  if (Number.isFinite(n) === false) {
    throw ValidationError.create("numeric patch overflow");
  }
  return n;
}

function applyOp(current: number, patch: NumericPatch): number {
  if ("add" in patch) {
    return finiteNumber(current + patch.add);
  }
  if ("sub" in patch) {
    return finiteNumber(current - patch.sub);
  }
  if ("mul" in patch) {
    return finiteNumber(current * patch.mul);
  }
  if (patch.div === 0) {
    throw ValidationError.create("numeric patch division by zero");
  }
  return finiteNumber(current / patch.div);
}

export function applyNumericPatches(existing: EntityRecord, body: JsonObject): EntityRecord {
  const next = copyJsonObject(existing);
  let patched = false;
  for (const [key, value] of Object.entries(body)) {
    if (isNumericPatch(value) === false) {
      continue;
    }
    const held = entityValueAt(existing, key);
    if (held.length < 1) {
      throw ValidationError.create("numeric patch field missing");
    }
    const current = firstPresent(held, "numeric patch field missing");
    if (typeof current !== "number") {
      throw ValidationError.create("numeric patch requires a number field");
    }
    if (Number.isFinite(current) === false) {
      throw ValidationError.create("numeric patch requires a number field");
    }
    next[key] = applyOp(current, value);
    patched = true;
  }
  if (patched === false) {
    return existing;
  }
  return entityRecordFromPlain(next);
}
