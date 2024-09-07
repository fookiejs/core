import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"

export default Rule.new({
    key: "check_type",
    execute: async function (payload) {
        for (const field in payload.body) {
            const type = payload.schema[field].type
            if (!lodash.isNull(payload.body[field]) && !type.validate(payload.body[field])) {
                return false
            }
        }
        return true
    },
})
