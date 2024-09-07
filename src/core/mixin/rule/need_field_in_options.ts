import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"
import { Method } from "../../method"

export default Rule.new({
    key: "need_field_in_options",
    execute: async function (payload) {
        if (payload.method !== Method.SUM) {
            return true
        }
        return (
            lodash.has(payload, "fieldName") &&
            typeof payload.fieldName == "string" &&
            lodash.keys(payload.modelClass.schema()).concat("id").includes(payload.fieldName)
        )
    },
})
