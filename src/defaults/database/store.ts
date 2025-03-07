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
    modify: function <model extends Model>() {
        let pool: model[] = []

        return {
            create: async (payload) => {
                pool.push(payload.body as any)
                return payload.body
            },
            read: async (payload) => {
                const attributes = payload.query.attributes

                let res = poolFilter(pool, payload.query)

                res = res.map(function (entity) {
                    return lodash.pick(entity, attributes)
                }) as model[]

                return res
            },
            update: async (payload) => {
                const entities = poolFilter(pool, payload.query)

                entities.forEach((entity) => {
                    Object.keys(payload.body).forEach((key) => {
                        entity[key] = payload.body[key]
                    })
                })

                return true
            },
            delete: async (payload) => {
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
                const filteredItems = poolFilter(pool, payload.query)
                const sum = filteredItems.reduce((acc, item) => {
                    if (typeof item[payload.fieldName] === "number") {
                        return acc + item[payload.fieldName]
                    }
                    return acc
                }, 0)

                return sum
            },
            count: async function (payload) {
                return poolFilter(pool, payload.query).length
            },
        }
    },
})

function poolFilter<model extends Model>(pool: model[], query: QueryType<model | any>) {
    const results = pool.filter(function (entity) {
        for (const field of Object.keys(query.filter) as Array<keyof model>) {
            const value = query.filter[field]!

            if (value.equals !== undefined && entity[field] !== value.equals) {
                return false
            }
            if (value.notEquals !== undefined && entity[field] === value.notEquals) {
                return false
            }

            if (value.in && !value.in.includes(entity[field] as never)) {
                return false
            }
            if (value.notIn && value.notIn.includes(entity[field] as never)) {
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
            if (
                value.like &&
                !new RegExp(value.like.replace(/%/g, ".*")).test(entity[field] as string)
            ) {
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
