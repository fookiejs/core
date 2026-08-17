export const Method = {
  CREATE: "create",
  LIST: "list",
  UPDATE: "update",
  DELETE: "delete",
} as const;

export type MethodName = (typeof Method)[keyof typeof Method];

export type RunEvent = {
  model: string;
  operation: string;
  id: string;
  runId: string;
  signal: string;
};

export type SettledEvent = RunEvent;

export type RealtimeRule<F = unknown> = {
  model: { name: string };
  method: string;
  who(
    clientIds: readonly string[],
    fookie: F,
  ): readonly string[] | Promise<readonly string[]>;
};

export type SettledSource = {
  onOperationSettled(listener: (event: RunEvent) => void): { stop(): boolean };
};

export type BusSubscription = {
  stop(): boolean;
};

export type RealtimeBus = {
  publish(event: SettledEvent): Promise<number> | number;
  subscribe(listener: (event: SettledEvent) => void): BusSubscription;
};

export type BatchConfig = {
  windowMs: number;
  max: number;
};

export type RealtimeOptions = {
  listen: readonly string[];
  bus: readonly RealtimeBus[];
  batch: readonly BatchConfig[];
};
