import type { ListResult } from "./engine/flow.ts";
import type { ListPage } from "./filter/ops.ts";
import type { FilterInput } from "./filter/schema.ts";
import type { ModelDef, ModelFieldsInput } from "./model.ts";
import type { PgParam, PgRow } from "./pg/encode.ts";
import type { EntityRecord } from "./values.ts";

export type ReadScope = {
  list<D extends ModelFieldsInput>(
    model: ModelDef<D>,
    filter: FilterInput,
    page?: ListPage,
  ): Promise<ListResult<EntityRecord>>;
  sql(statement: string, params: readonly PgParam[]): Promise<readonly PgRow[]>;
};
