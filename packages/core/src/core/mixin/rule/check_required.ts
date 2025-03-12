import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"
import { Required } from "../../field/field"

export default Rule.new({
    key: "check_required",
    execute: async function (payload) {
        const search = [null, undefined]
        const keys =
            payload.method == "create"
                ? lodash.keys(payload.model.schema())
                : lodash.keys(payload.body)
        for (const key of keys) {
            if (lodash.includes(payload.model.schema()[key].features, Required)) {
                if (search.includes(payload.body[key])) {
                    return false
                }
            }
        }
        return true
    },
})
