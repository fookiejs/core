import * as lodash from "lodash"
import { LifecycleFunction } from "../../../lifecycle-function"

export default LifecycleFunction.new({
    key: "validate_attributes",
    execute: async function (payload) {
        const keys = lodash.keys(payload.schema).concat(["id"])
        return payload.query.attributes.every(function (k) {
            return keys.includes(k)
        })
    },
})
