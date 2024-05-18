import * as lodash from "lodash"
import { LifecycleFunction } from "../../../lifecycle-function"

export default LifecycleFunction.new({
    key: "need_field_in_options",
    execute: async function (payload) {
        return (
            lodash.has(payload, "fieldName") &&
            typeof payload.fieldName == "string" &&
            lodash.keys(payload.schema).concat("id").includes(payload.fieldName)
        )
    },
})
