import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"

export default Rule.new({
    key: "validate_payload",
    execute: async function (payload) {
        if (lodash.has(payload, "options") && !lodash.isObject(payload.options)) {
            return false
        }

        if (
            lodash.has(payload.options, "token") &&
            !lodash.isNil(payload.options.token) &&
            !(lodash.isString(payload.options.token) || lodash.isSymbol(payload.options.token))
        ) {
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

        const avaible_keys = [
            "schema",
            "state",
            "method",
            "model",
            "model",
            "options",
            "token",
            "body",
            "query",
            "runId",
            "fieldName",
        ]

        return lodash.without(lodash.keys(payload), ...avaible_keys).length === 0
    },
})
