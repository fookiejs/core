import { z } from "zod";
import { DatabaseError, ModelFieldError, PgEncodeError } from "@fookiejs/core";
import { compareBoundOk, escapeLikePattern, nearPoint } from "@fookiejs/core";
import { filterClauseUnsupported } from "@fookiejs/core";
import type { FilterState } from "@fookiejs/core";
import type { ModelDef, ModelFieldsInput } from "@fookiejs/core";
import { entityValueToPg, fieldGroupFor } from "@fookiejs/core";
import type { PgParam } from "@fookiejs/core";
import { quotedColumnFor } from "@fookiejs/core";
import { appendItem, firstFilterGroup } from "@fookiejs/core";
import { isEntityValue, jsonWireSchema } from "@fookiejs/core";
import type { EntityValue, FilterGroup } from "@fookiejs/core";

export const filterBoundSchema = z.union([z.number().finite(), z.string()]);

export const filterTextSchema = z.string();

export type SqlCompareOpKinds = {
  eq: "=";
  ne: "<>";
};

export type SqlCompareOp = SqlCompareOpKinds[keyof SqlCompareOpKinds];

export type WhereBuild = {
  parts: readonly string[];
  params: readonly PgParam[];
  index: number;
};

export class WhereSql {
  readonly sql: string;
  readonly params: readonly PgParam[];

  private constructor(sql: string, params: readonly PgParam[]) {
    if (z.string().min(1).safeParse(sql).success === false) {
      throw DatabaseError.create("where sql required");
    }
    if (Array.isArray(params) === false) {
      throw DatabaseError.create("where params required");
    }
    this.sql = sql;
    this.params = params;
  }

  private static push(build: WhereBuild, sql: string, sqlParam: PgParam): WhereBuild {
    if (z.string().min(1).safeParse(sql).success === false) {
      throw DatabaseError.create("where fragment required");
    }
    if (Number.isFinite(build.index) === false || build.index < 1) {
      throw DatabaseError.create("where param index required");
    }
    return {
      parts: appendItem(build.parts, sql),
      params: appendItem(build.params, sqlParam),
      index: build.index + 1,
    };
  }

  private static pushCompare(
    build: WhereBuild,
    col: string,
    op: SqlCompareOp,
    compareValue: EntityValue,
    group: FilterGroup,
  ): WhereBuild {
    try {
      return WhereSql.push(
        build,
        `${col} ${op} $${build.index}`,
        entityValueToPg(compareValue, group),
      );
    } catch (err) {
      if (err instanceof PgEncodeError) {
        throw ModelFieldError.create(err.message);
      }
      throw err;
    }
  }

  static fromFilter(model: ModelDef<ModelFieldsInput>, filter: FilterState): WhereSql {
    let build: WhereBuild = {
      parts: ["is_deleted = false"],
      params: [],
      index: 1,
    };
    for (const [key, clause] of Object.entries(filter)) {
      const groups = fieldGroupFor(model, key);
      if (groups.length < 1) {
        throw ModelFieldError.create(`unknown filter field ${key}`);
      }
      const group = firstFilterGroup(groups);
      if (filterClauseUnsupported(group, clause) === true) {
        throw ModelFieldError.create(`unsupported filter on ${key}`);
      }
      const col = quotedColumnFor(key);
      if ("eq" in clause) {
        const eqParsed = jsonWireSchema.safeParse(clause.eq);
        if (eqParsed.success === false || isEntityValue(eqParsed.data) === false) {
          throw ModelFieldError.create(`invalid eq on ${key}`);
        }
        build = WhereSql.pushCompare(build, col, "=", eqParsed.data, group);
      }
      if ("ne" in clause) {
        const neParsed = jsonWireSchema.safeParse(clause.ne);
        if (neParsed.success === false || isEntityValue(neParsed.data) === false) {
          throw ModelFieldError.create(`invalid ne on ${key}`);
        }
        build = WhereSql.pushCompare(build, col, "<>", neParsed.data, group);
      }
      if ("gt" in clause) {
        const bound = filterBoundSchema.safeParse(clause.gt);
        if (bound.success === false || compareBoundOk(group, bound.data) === false) {
          throw ModelFieldError.create(`invalid gt on ${key}`);
        }
        build = WhereSql.push(build, `${col} > $${build.index}`, bound.data);
      }
      if ("gte" in clause) {
        const bound = filterBoundSchema.safeParse(clause.gte);
        if (bound.success === false || compareBoundOk(group, bound.data) === false) {
          throw ModelFieldError.create(`invalid gte on ${key}`);
        }
        build = WhereSql.push(build, `${col} >= $${build.index}`, bound.data);
      }
      if ("lt" in clause) {
        const bound = filterBoundSchema.safeParse(clause.lt);
        if (bound.success === false || compareBoundOk(group, bound.data) === false) {
          throw ModelFieldError.create(`invalid lt on ${key}`);
        }
        build = WhereSql.push(build, `${col} < $${build.index}`, bound.data);
      }
      if ("lte" in clause) {
        const bound = filterBoundSchema.safeParse(clause.lte);
        if (bound.success === false || compareBoundOk(group, bound.data) === false) {
          throw ModelFieldError.create(`invalid lte on ${key}`);
        }
        build = WhereSql.push(build, `${col} <= $${build.index}`, bound.data);
      }
      if ("like" in clause) {
        const text = filterTextSchema.safeParse(clause.like);
        if (text.success === false) {
          throw ModelFieldError.create(`invalid like on ${key}`);
        }
        build = WhereSql.push(build, `${col} LIKE $${build.index} ESCAPE E'\\\\'`, text.data);
      }
      if ("ilike" in clause) {
        const text = filterTextSchema.safeParse(clause.ilike);
        if (text.success === false) {
          throw ModelFieldError.create(`invalid ilike on ${key}`);
        }
        build = WhereSql.push(build, `${col} ILIKE $${build.index} ESCAPE E'\\\\'`, text.data);
      }
      if ("startsWith" in clause) {
        const text = filterTextSchema.safeParse(clause.startsWith);
        if (text.success === false) {
          throw ModelFieldError.create(`invalid startsWith on ${key}`);
        }
        build = WhereSql.push(
          build,
          `${col} LIKE $${build.index} ESCAPE E'\\\\'`,
          `${escapeLikePattern(text.data)}%`,
        );
      }
      if ("endsWith" in clause) {
        const text = filterTextSchema.safeParse(clause.endsWith);
        if (text.success === false) {
          throw ModelFieldError.create(`invalid endsWith on ${key}`);
        }
        build = WhereSql.push(
          build,
          `${col} LIKE $${build.index} ESCAPE E'\\\\'`,
          `%${escapeLikePattern(text.data)}`,
        );
      }
      if ("contains" in clause) {
        const text = filterTextSchema.safeParse(clause.contains);
        if (text.success === false) {
          throw ModelFieldError.create(`invalid contains on ${key}`);
        }
        build = WhereSql.push(
          build,
          `${col}::text ILIKE $${build.index} ESCAPE E'\\\\'`,
          `%${escapeLikePattern(text.data)}%`,
        );
      }
      if ("in" in clause) {
        if (Array.isArray(clause.in) === false || clause.in.length < 1) {
          throw ModelFieldError.create(`invalid in on ${key}`);
        }
        let slots: readonly string[] = [];
        try {
          for (const inOperand of clause.in) {
            slots = appendItem(slots, `$${build.index}`);
            build = {
              parts: build.parts,
              params: appendItem(build.params, entityValueToPg(inOperand, group)),
              index: build.index + 1,
            };
          }
        } catch (err) {
          if (err instanceof PgEncodeError) {
            throw ModelFieldError.create(err.message);
          }
          throw err;
        }
        build = {
          parts: appendItem(build.parts, `${col} IN (${slots.join(", ")})`),
          params: build.params,
          index: build.index,
        };
      }
      if ("near" in clause) {
        if (Array.isArray(clause.near) === false) {
          throw ModelFieldError.create(`invalid near on ${key}`);
        }
        const point = nearPoint(clause.near);
        const nearParams = appendItem(
          appendItem(appendItem(build.params, point.x), point.y),
          point.meters,
        );
        build = {
          parts: appendItem(
            build.parts,
            `${col} <@ circle(point($${build.index}, $${build.index + 1}), $${build.index + 2})`,
          ),
          params: nearParams,
          index: build.index + 3,
        };
      }
    }
    return new WhereSql(build.parts.join(" AND "), build.params);
  }
}
