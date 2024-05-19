import * as lodash from "lodash"
import { Database, Model, QueryType } from "../../exports"

export const store = Database.new({
    key: "store",
    connect: async function () {
        return
    },
    disconnect: async function () {
        return
    },
    modify: function Partial<T extends Model>() {
        let pool: T[] = []

        return {
            create: async (payload) => {
                pool.push(payload.body)
                return payload.body
            },
            read: async (payload) => {
                const attributes = ["id"].concat(payload.query.attributes ?? [])

                let res = poolFilter(pool, payload.query)

                res = res.map(function (entity: T) {
                    return lodash.pick(entity, attributes)
                })

                return res
            },
            update: async (payload) => {
                const ids = poolFilter(pool, payload.query).map(function (i: T) {
                    return i.id
                })
                for (const item of pool) {
                    for (const key in payload.body) {
                        if (ids.includes(item.id)) {
                            item[key] = payload.body[key]
                        }
                    }
                }
                return true
            },
            del: async (payload) => {
                const filtered = poolFilter(pool, payload.query).map(function (f) {
                    return f.id
                })
                const rejected = lodash.reject(pool, function (entity) {
                    return filtered.includes(entity.id)
                })
                pool = rejected
                return true
            },
            sum: async (payload) => {
                return poolFilter(pool, payload.query).length
            },
            count: async function (payload) {
                return poolFilter(pool, payload.query).length
            },
        }
    },
})

function poolFilter(pool: any[], query: QueryType<unknown>["filter"]) {
    const results = pool.filter(function (entity) {
        for (const field in query!.filter) {
            const value = query.filter[field]

            if (value.equals !== undefined && entity[field] !== value.equals) {
                return false
            }
            if (value.notEquals !== undefined && entity[field] === value.notEquals) {
                return false
            }

            if (value.in && !value.in.includes(entity[field])) {
                return false
            }
            if (value.notIn && value.notIn.includes(entity[field])) {
                return false
            }
            if (value.lt !== undefined && entity[field] >= value.lt) {
                return false
            }
            if (value.lte !== undefined && entity[field] > value.lte) {
                return false
            }
            if (value.gt !== undefined && entity[field] <= value.gt) {
                return false
            }
            if (value.gte !== undefined && entity[field] < value.gte) {
                return false
            }
            if (value.like && !new RegExp(value.like.replace(/%/g, ".*")).test(entity[field])) {
                return false
            }
            if (lodash.isBoolean(value.isNull)) {
                if (value.isNull && entity[field] !== null) {
                    return false
                }
                if (!value.isNull && entity[field] === null) {
                    return false
                }
            }
        }
        return true
    })
    return lodash.slice(results, query.offset, query.offset + query.limit)
}
