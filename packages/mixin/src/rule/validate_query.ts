import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const validate_query: LifecycleFunction = async function (payload) {
    const filter_keys = lodash.keys(payload.query.filter)
    const model_keys = lodash.keys(payload.model.schema)

    if (lodash.has(payload.query, "filter") && !lodash.isObject(payload.query.filter)) {
        return false
    }
    if (lodash.has(payload.query, "limit") && !lodash.isNumber(payload.query.limit)) {
        return false
    }
    if (lodash.has(payload.query, "offset") && !lodash.isNumber(payload.query.offset)) {
        return false
    }
    if (lodash.difference(filter_keys, [...model_keys, payload.model.database.pk]).length > 0) {
        return false
    }

    for (const key of lodash.keys(payload.query.filter)) {
        const field = payload.query.filter[key]
        if (lodash.isObject(field)) {
            if (field.gte && !lodash.isNumber(field.gte)) {
                return false
            }
            if (field.gt && !lodash.isNumber(field.gt)) {
                return false
            }
            if (field.lte && !lodash.isNumber(field.lte)) {
                return false
            }
            if (field.lt && !lodash.isNumber(field.lt)) {
                return false
            }
            if (field.inc && !lodash.isString(field.inc)) {
                return false
            }
            if (field.or && !lodash.isArray(field.or)) {
                return false
            }
            if (field.notor && !lodash.isArray(field.notor)) {
                return false
            }
        }
    }
    return true
}

export default validate_query
