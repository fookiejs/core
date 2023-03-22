import * as lodash from "lodash"
import { models, run } from "../../../core"
import { Read, Delete, Create, Count } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const set_default: LifecycleFunction = async function (payload, state) {
    let model = payload.model
    let defaults = lodash.mapValues(model.schema, function (o) {
        return o.default
    })
    defaults = lodash.pickBy(defaults, function (v) {
        return !lodash.isUndefined(v)
    })
    payload.body = lodash.defaults(payload.body, defaults)
}

export default set_default
