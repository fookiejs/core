import * as lodash from "lodash"
import { LifecycleFunction } from "../../../lifecycle-function"

export default LifecycleFunction.new({
    key: "set_default",
    execute: async function (payload) {
        let defaults = lodash.mapValues(payload.schema, function (o) {
            return o.default
        })
        defaults = lodash.pickBy(defaults, function (v) {
            return !lodash.isUndefined(v)
        })
        payload.body = lodash.defaults(payload.body, defaults)
    },
})
