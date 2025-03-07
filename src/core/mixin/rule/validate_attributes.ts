import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"
import { Method } from "../../method"

export default Rule.new({
    key: "validate_attributes",
    execute: async function (payload) {
        if (payload.method !== Method.READ) {
            return true
        }

        const keys = lodash.keys(payload.model.schema()).concat(["id"])
        return payload.query.attributes.every(function (k) {
            return keys.includes(k)
        })
    },
})
