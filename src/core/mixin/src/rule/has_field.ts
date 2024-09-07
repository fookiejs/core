import * as lodash from "lodash"
import { Rule } from "../../../lifecycle-function"

export default Rule.new({
    key: "has_field",
    execute: async function (payload) {
        const body_keys = lodash.keys(payload.body)

        const schema_keys = lodash.keys(payload.schema)
        for (const key of body_keys) {
            if (!schema_keys.includes(key)) {
                return false
            }
        }
        return true
    },
})
