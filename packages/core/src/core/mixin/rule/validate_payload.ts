import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"

export default Rule.new({
    key: "validate_payload",
    execute: async function (payload) {
        if (lodash.has(payload, "options") && !lodash.isObject(payload.options)) {
            return false
        }

        if (
            lodash.has(payload.options, "sub") &&
            !lodash.isNil(payload.options.sub) &&
            !(lodash.isString(payload.options.sub) || lodash.isSymbol(payload.options.sub))
        ) {
            return false
        }

        if (lodash.has(payload, "body") && !lodash.isObject(payload.body)) {
            return false
        }

        if (lodash.has(payload, "query") && !lodash.isObject(payload.query)) {
            return false
        }

        const avaible_keys = ["state", "method", "model", "options", "body", "query", "runId"]

        return lodash.without(lodash.keys(payload), ...avaible_keys).length === 0
    },
})
