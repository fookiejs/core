import * as lodash from "lodash"
import { LifecycleFunction } from "../../../lifecycle-function"
import { methods } from "../../../method"

export default LifecycleFunction.new({
    key: "has_method",
    execute: async function (payload) {
        return lodash.includes(methods, payload.method)
    },
})
