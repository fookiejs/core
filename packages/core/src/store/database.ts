import type { EntityStore } from "./entity-store.ts";
import type { StoreDbErrorHandler } from "./query.ts";

export type OpenContext = {
  onDbError: readonly StoreDbErrorHandler[];
};

export type StoreBinding = {
  database: string;
  store: EntityStore;
  close: readonly (() => Promise<void>)[];
};

export type Database = {
  key: string;
  kind: string;
  softDelete: boolean;
  open: (context: OpenContext) => StoreBinding;
};
