import type { Signal } from "./signal.ts";

export type OperationEvent = {
  model: string;
  operation: string;
  id: string;
  runId: string;
  signal: Signal;
};

export type OperationListener = (event: OperationEvent) => void;

export type OperationSubscription = {
  stop(): boolean;
};
