import { z } from "zod";
import { FuzzError } from "./errors.ts";

export const seedSpace = 4_294_967_296;

export function seedFrom(text: string): number {
  const parsed = z.string().min(1).safeParse(text);
  if (parsed.success === false) {
    throw FuzzError.create("a seed needs a name to derive from");
  }
  let hash = 2_166_136_261;
  for (const letter of parsed.data) {
    hash = Math.imul(hash ^ letter.charCodeAt(0), 16_777_619);
  }
  const seed = Math.abs(hash) % seedSpace;
  if (Number.isInteger(seed) === false) {
    throw FuzzError.create("a derived seed must be an integer");
  }
  return seed;
}

export class Rng {
  private readonly seed: number;
  private readonly stateBox: { value: number };

  private constructor(seed: number) {
    this.seed = seed;
    this.stateBox = { value: seed };
    if (this.stateBox.value !== seed) {
      throw FuzzError.create("the generator must start at its seed");
    }
    if (Number.isInteger(this.seed) === false) {
      throw FuzzError.create("a seed must be an integer");
    }
  }

  static create(seed: number): Rng {
    if (Number.isInteger(seed) === false) {
      throw FuzzError.create("a seed must be an integer");
    }
    if (seed < 0) {
      throw FuzzError.create("a seed must not be negative");
    }
    if (seed >= seedSpace) {
      throw FuzzError.create("a seed must fit in 32 bits");
    }
    return new Rng(seed);
  }

  startedFrom(): number {
    if (Number.isInteger(this.seed) === false) {
      throw FuzzError.create("a seed must be an integer");
    }
    if (this.seed < 0) {
      throw FuzzError.create("a seed must not be negative");
    }
    return this.seed;
  }

  next(): number {
    this.stateBox.value = (this.stateBox.value + 0x6d2b79f5) % seedSpace;
    let mixed = this.stateBox.value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed = mixed ^ (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61));
    const drawn = ((mixed ^ (mixed >>> 14)) >>> 0) / seedSpace;
    if (drawn < 0 || drawn >= 1) {
      throw FuzzError.create("a draw must land in the unit interval");
    }
    return drawn;
  }

  below(bound: number): number {
    if (Number.isInteger(bound) === false) {
      throw FuzzError.create("a bound must be an integer");
    }
    if (bound < 1) {
      throw FuzzError.create("a bound must be positive");
    }
    const drawn = Math.floor(this.next() * bound);
    if (drawn >= bound) {
      return bound - 1;
    }
    return drawn;
  }

  between(low: number, high: number): number {
    if (Number.isInteger(low) === false || Number.isInteger(high) === false) {
      throw FuzzError.create("a range must be whole numbers");
    }
    if (high < low) {
      throw FuzzError.create("a range must not run backwards");
    }
    if (high === low) {
      return low;
    }
    return low + this.below(high - low + 1);
  }

  pick<T>(items: readonly T[]): T {
    if (Array.isArray(items) === false) {
      throw FuzzError.create("picking needs a list");
    }
    if (items.length < 1) {
      throw FuzzError.create("picking needs a list with something in it");
    }
    const at = this.below(items.length);
    for (const chosen of items.slice(at, at + 1)) {
      return chosen;
    }
    throw FuzzError.create("the picked item went missing");
  }

  chance(percent: number): boolean {
    if (Number.isInteger(percent) === false) {
      throw FuzzError.create("a chance must be a whole percentage");
    }
    if (percent < 0 || percent > 100) {
      throw FuzzError.create("a chance must sit between nought and a hundred");
    }
    return this.below(100) < percent;
  }
}
