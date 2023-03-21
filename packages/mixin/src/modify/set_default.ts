import * as lodash from "lodash"
import { v4 } from "uuid"
import { models, run } from "@fookie/core"
import { Delete, Read } from "@fookie/method"
import { LifecycleFunction } from "@fookie/core"

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