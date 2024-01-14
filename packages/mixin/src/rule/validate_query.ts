import * as lodash from "lodash"
import { LifecycleFunction, FilterFieldInterface, Method } from "../../../../types"

const validate_query: LifecycleFunction<unknown, Method> = async function (payload) {
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
        const field = payload.query.filter[key] as FilterFieldInterface
        const type = payload.model.database.pk === key ? payload.model.database.pk_type : payload.model.schema[key].type
        const valid_filter_keys = lodash.keys(type.query).concat(payload.model.database.pk)

        if (lodash.pull(lodash.keys(field), ...valid_filter_keys).length > 0) {
            return false
        }

        if (!lodash.isObject(field)) {
            return false
        }

        if (Object.keys(field).length > 0 && type.query_controller(field) === false) {
            return false
        }
    }
    return true
}

export default validate_query
