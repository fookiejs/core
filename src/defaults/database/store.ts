import * as lodash from "lodash";
import { Database, ModelType, QueryType } from "../../exports.ts";
import { SchemaType } from "../../core/schema.ts";

export const store = Database.new({
    key: "store",
    connect: async function () {
        return;
    },
    disconnect: async function () {
        return;
    },
    modify: function () {
        let pool: any[] = [];

        return {
            create: async (payload) => {
                pool.push(payload.body);
                return payload.body;
            },
            read: async (payload) => {
                const filter = payload.query.filter;

                const attributes = ["id"].concat(payload.query.attributes);

                let res = poolFilter(pool, filter);

                res = res.map(function (entity: any) {
                    return lodash.pick(entity, attributes);
                });

                res = lodash.slice(
                    res,
                    payload.query.offset,
                    payload.query.offset + payload.query.limit,
                );

                return res;
            },
            update: async (payload) => {
                const ids = poolFilter(pool, payload.query.filter).map(function (i: any) {
                    return i.id;
                });
                for (const item of pool) {
                    for (const key in payload.body) {
                        if (ids.includes(item.id)) {
                            item[key] = payload.body[key];
                        }
                    }
                }
                return true;
            },
            del: async (payload) => {
                const filtered = poolFilter(pool, payload.query.filter).map(function (f) {
                    return f.id;
                });
                const rejected = lodash.reject(pool, function (entity) {
                    return filtered.includes(entity.id);
                });
                pool = rejected;
                return true;
            },
            sum: async (payload) => {
                return poolFilter(pool, payload.query.filter).length;
            },
            count: async function (payload) {
                return poolFilter(pool, payload.query.filter).length;
            },
        };
    },
});

function poolFilter(pool: any[], filter: QueryType<any>["filter"]) {
    return pool.filter(function (entity) {
        for (const field in filter) {
            const value = filter[field];

            if (value.equals !== undefined && entity[field] !== value.equals) {
                return false;
            }
            if (value.notEquals !== undefined && entity[field] === value.notEquals) {
                return false;
            }
            if (value.in && !value.in.includes(entity[field])) {
                return false;
            }
            if (value.notIn && value.notIn.includes(entity[field])) {
                return false;
            }
            if (value.lt !== undefined && entity[field] >= value.lt) {
                return false;
            }
            if (value.lte !== undefined && entity[field] > value.lte) {
                return false;
            }
            if (value.gt !== undefined && entity[field] <= value.gt) {
                return false;
            }
            if (value.gte !== undefined && entity[field] < value.gte) {
                return false;
            }
            if (value.like && !new RegExp(value.like.replace(/%/g, ".*")).test(entity[field])) {
                return false;
            }
            if (value.isNull !== undefined) {
                if (value.isNull && entity[field] !== null) {
                    return false;
                }
                if (!value.isNull && entity[field] === null) {
                    return false;
                }
            }
        }
        return true;
    });
}
