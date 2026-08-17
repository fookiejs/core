import { ModelFieldError } from "../errors.ts";
import type { OutboxStatus, Phase } from "../signal.ts";

export type LockModeKinds = {
  write: "write";
};

export type LockMode = LockModeKinds[keyof LockModeKinds];

export type RunQuery = {
  phase: readonly Phase[];
  limit: number;
  offset: number;
};

export type OutboxQuery = {
  status: readonly OutboxStatus[];
  runId: readonly string[];
  limit: number;
  offset: number;
};

export function pageBound(bound: number): number {
  if (Number.isInteger(bound) === false) {
    throw ModelFieldError.create("listing bound must be an integer");
  }
  if (bound < 0) {
    throw ModelFieldError.create("listing bound must not be negative");
  }
  return bound;
}

export type StoreDbErrorHandler = (message: string) => void;
