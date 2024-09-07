import * as lodash from "lodash"
import { Rule } from "../../../lifecycle-function"

export default Rule.new({
    key: "check_required",
    execute: async function (payload) {
        const search = [null, undefined]
        const keys =
            payload.method == "create" ? lodash.keys(payload.schema) : lodash.keys(payload.body)
        for (const key of keys) {
            if (payload.schema[key].required == true) {
                if (search.includes(payload.body[key])) {
                    return false
                }
            }
        }
        return true
    },
})
