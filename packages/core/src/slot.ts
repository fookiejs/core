import { ModelFieldError, ValidationError } from "./errors.ts";
import type { FilterGroup } from "./values.ts";

export function mapLookup<K, V>(map: Map<K, V>, key: K): V[] {
  const held = map.get(key);
  if (held === undefined) {
    return [];
  }
  return [held];
}

export function catchValidation<T>(run: () => T): T[] {
  try {
    return [run()];
  } catch (err) {
    if (err instanceof ValidationError) {
      return [];
    }
    throw err;
  }
}

export function appendItem<T>(items: readonly T[], nextItem: T): T[] {
  return items.toSpliced(items.length, 0, nextItem);
}

export function firstPresent<T>(hits: readonly T[], message: string): T {
  for (const hit of hits) {
    return hit;
  }
  throw ValidationError.create(message);
}

export function firstFilterGroup(groups: readonly FilterGroup[]): FilterGroup {
  for (const group of groups) {
    return group;
  }
  throw ModelFieldError.create("filter group required");
}
