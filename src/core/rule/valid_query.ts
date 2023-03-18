import * as lodash from "lodash"

const valid_query: LifecycleFunction = async function (payload, state) {
    const accepted_keywords = ["gte"] //TODO
    let filter_keys = lodash.keys(payload.query.filter)
    let model_keys = lodash.keys(payload.model.schema)
    if (lodash.has(payload.query, "filter") && !lodash.isObject(payload.query.filter)) return false
    if (lodash.has(payload.query, "limit") && !lodash.isNumber(payload.query.limit)) return false
    if (lodash.has(payload.query, "offset") && !lodash.isNumber(payload.query.offset)) return false
    if (lodash.difference(filter_keys, [...model_keys, payload.model.database.pk]).length > 0) return false

    for (let key of lodash.keys(payload.query.filter)) {
        let field = payload.query.filter[key]
        if (lodash.isObject(field) && lodash.difference(lodash.keys(field), accepted_keywords).length != 0) {
            return false
        }
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

export default valid_query
