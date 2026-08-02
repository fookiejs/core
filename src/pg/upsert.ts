import { z } from "zod";
import { DatabaseError, ModelFieldError } from "../errors.ts";
import type { ModelDef, ModelFieldsInput } from "../model.ts";
import { entityValueToPg, fieldGroupFor } from "./encode.ts";
import type { PgParam } from "./encode.ts";
import { quotedColumnFor, quotedTableFor } from "./naming.ts";
import { appendItem, firstFilterGroup } from "../slot.ts";
import { entityValueAt } from "../values.ts";
import type { EntityRecord } from "../values.ts";

export class UpsertSql {
  readonly sql: string;
  readonly values: readonly PgParam[];

  private constructor(sql: string, values: readonly PgParam[]) {
    if (z.string().min(1).safeParse(sql).success === false) {
      throw DatabaseError.create("upsert sql required");
    }
    if (Array.isArray(values) === false) {
      throw DatabaseError.create("upsert values required");
    }
    this.sql = sql;
    this.values = values;
  }

  static fromEntity(model: ModelDef<ModelFieldsInput>, entity: EntityRecord): UpsertSql {
    let columns: readonly string[] = [];
    let placeholders: readonly string[] = [];
    let updates: readonly string[] = [];
    let values: readonly PgParam[] = [];
    let index = 1;
    for (const [key] of Object.entries(model.fields)) {
      const groups = fieldGroupFor(model, key);
      if (groups.length < 1) {
        throw ModelFieldError.create(`unknown field ${key}`);
      }
      const group = firstFilterGroup(groups);
      const col = quotedColumnFor(key);
      columns = appendItem(columns, col);
      placeholders = appendItem(placeholders, `$${index}`);
      if (col !== "id") {
        updates = appendItem(updates, `${col} = EXCLUDED.${col}`);
      }
      const raws = entityValueAt(entity, key);
      if (raws.length < 1) {
        throw ModelFieldError.create(`missing field ${key}`);
      }
      for (const raw of raws) {
        values = appendItem(values, entityValueToPg(raw, group));
      }
      index += 1;
    }
    const table = quotedTableFor(model.name);
    return new UpsertSql(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`,
      values,
    );
  }
}
