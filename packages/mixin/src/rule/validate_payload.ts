import * as lodash from "lodash"
import { LifecycleFunction, Method } from "../../../../types"

const validate_payload: LifecycleFunction<unknown, Method> = async function (payload) {
    if (lodash.has(payload, "options") && !lodash.isObject(payload.options)) {
        return false
    }
    if (lodash.has(payload, "token") && !lodash.isString(payload.token)) {
        return false
    }
    if (lodash.has(payload, "body") && !lodash.isObject(payload.body)) {
        return false
    }
    if (lodash.has(payload, "query") && !lodash.isObject(payload.query)) {
        return false
    }
    if (lodash.has(payload.options, "drop") && !lodash.isNumber(payload.options.drop)) {
        return false
    }
    if (lodash.has(payload.options, "method") && !lodash.isString(payload.options.method)) {
        return false
    }
    if (lodash.has(payload.options, "simplified") && !lodash.isBoolean(payload.options.simplified)) {
        return false
    }

    const avaible_keys = ["response", "method", "model", "options", "token", "body", "query", "id"]
    return lodash.without(lodash.keys(payload), ...avaible_keys).length === 0
}

export default validate_payload
