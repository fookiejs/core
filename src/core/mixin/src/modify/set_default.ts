import * as lodash from "lodash"
import { LifecycleFunction } from "../../../lifecycle-function"

export default LifecycleFunction.new({
    key: "set_default",
    execute: async function (payload) {
        const pureDefaults = lodash.mapValues(payload.schema, function (o) {
            return o.default
        })

        const defaults = lodash.pickBy(pureDefaults, function (v) {
            return !lodash.isUndefined(v)
        })
        payload.body = lodash.defaults(payload.body, defaults)
    },
})
