import * as lodash from "lodash"
import { Rule } from "../../../lifecycle-function"

export default Rule.new({
    key: "validate_attributes",
    execute: async function (payload) {
        const keys = lodash.keys(payload.schema).concat(["id"])
        return payload.query.attributes.every(function (k) {
            return keys.includes(k)
        })
    },
})
