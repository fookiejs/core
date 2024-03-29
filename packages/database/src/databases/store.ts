import * as lodash from "lodash"
import { v4 } from "uuid"
import * as Type from "../../../type"
import { DatabaseInterface } from "../../../../types"

export const store: DatabaseInterface = {
    pk: "id",
    pk_type: Type.text,
    connect: async function () {
        return true
    },
    disconnect: async function () {
        return true
    },
    modify: function (model) {
        let pool = []
        model.methods = {}

        model.methods.read = async function (_payload) {
            const filter = _payload.query.filter
            const attributes = ["id"].concat(_payload.query.attributes)
            let res = poolFilter(pool, filter)
            res = res.map(function (entity) {
                return lodash.pick(entity, attributes)
            })
            res = lodash.slice(res, _payload.query.offset, _payload.query.offset + _payload.query.limit)
            _payload.response.data = res
        }

        model.methods.create = async function (_payload) {
            const attributes = ["id"].concat(_payload.query.attributes)
            _payload.body.id = v4().replace("-", "")
            pool.push(_payload.body)
            _payload.response.data = lodash.pick(_payload.body, attributes)
        }

        model.methods.update = async function (_payload) {
            const ids = poolFilter(pool, _payload.query.filter).map(function (i) {
                return i[model.database.pk]
            })
            for (const item of pool) {
                for (const key in _payload.body) {
                    if (ids.includes(item.id)) {
                        item[key] = _payload.body[key]
                    }
                }
            }
            _payload.response.data = true
        }

        model.methods.delete = async function (_payload) {
            const filtered = poolFilter(pool, _payload.query.filter).map(function (f) {
                return f.id
            })
            const rejected = lodash.reject(pool, function (entity) {
                return filtered.includes(entity.id)
            })
            pool = rejected
            _payload.response.data = true
        }

        model.methods.count = async function (_payload) {
            _payload.response.data = poolFilter(pool, _payload.query.filter).length
        }
    },
}

function poolFilter(pool, filter) {
    return pool.filter(function (entity) {
        for (const field in filter) {
            const value = filter[field]

            if (value.equals !== undefined && entity[field] !== value.equals) {
                return false
            }
            if (value.not !== undefined && entity[field] === value.not) {
                return false
            }
            if (value.in && !value.in.includes(entity[field])) {
                return false
            }
            if (value.not_in && value.not_in.includes(entity[field])) {
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
            if (value.contains && !entity[field].includes(value.contains)) {
                return false
            }
            if (value.include && !value.include.every((val) => entity[field].includes(val))) {
                return false
            }
            if (value.exclude && value.exclude.some((val) => entity[field].includes(val))) {
                return false
            }
        }
        return true
    })
}
