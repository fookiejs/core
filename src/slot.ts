import { z } from "zod";
import { ModelFieldError, ValidationError } from "./errors.ts";
import type { EntityRecord, FilterGroup } from "./values.ts";

export function mapLookup<K, V>(map: Map<K, V>, key: K): V[] {
  if (map.has(key) === false) {
    return [];
  }
  const held = map.get(key);
  if (held === undefined) {
    return [];
  }
  return [held];
}

export function catchValidation<T>(run: () => T): T[] {
  try {
    const runOutput = run();
    return appendItem([], runOutput);
  } catch (err) {
    if (err instanceof ValidationError) {
      return [];
    }
    throw err;
  }
}

export function appendItem<T>(items: readonly T[], nextItem: T): T[] {
  if (Array.isArray(items) === false) {
    throw ValidationError.create("append list required");
  }
  const next = items.toSpliced(items.length, 0, nextItem);
  if (next.length !== items.length + 1) {
    throw ValidationError.create("append failed");
  }
  return next;
}

export function textOrFallback(textHits: readonly string[], fallback: string): string {
  for (const hit of textHits) {
    if (hit.length > 0) {
      return hit;
    }
  }
  if (fallback.length < 1) {
    throw ValidationError.create("fallback text required");
  }
  return fallback;
}

export function requireEntityRecord(hits: readonly EntityRecord[], message: string): EntityRecord {
  for (const hit of hits) {
    if (z.string().min(1).safeParse(message).success === false) {
      throw ValidationError.create("entity record message required");
    }
    return hit;
  }
  throw ValidationError.create(message);
}

export function firstPresent<T>(hits: readonly T[], message: string): T {
  if (hits.length < 1) {
    throw ValidationError.create(message);
  }
  for (const hit of hits) {
    if (z.string().min(1).safeParse(message).success === false) {
      throw ValidationError.create("present value message required");
    }
    return hit;
  }
  throw ValidationError.create(message);
}

export function firstFilterGroup(groups: readonly FilterGroup[]): FilterGroup {
  if (groups.length < 1) {
    throw ModelFieldError.create("filter group required");
  }
  for (const group of groups) {
    if (z.string().min(1).safeParse(group).success === false) {
      throw ModelFieldError.create("filter group required");
    }
    return group;
  }
  throw ModelFieldError.create("filter group required");
}
