import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const set_default: LifecycleFunction = async function (payload) {
    let defaults = lodash.mapValues(payload.model.schema, function (o) {
        return o.default
    })
    defaults = lodash.pickBy(defaults, function (v) {
        return !lodash.isUndefined(v)
    })
    payload.body = lodash.defaults(payload.body, defaults)
}

export default set_default
