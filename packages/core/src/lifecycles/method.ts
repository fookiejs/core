import * as lodash from "lodash"
import { After, Before } from "../../../mixin"
import { LifecycleFunction } from "../../../../types"

const method: LifecycleFunction = async function (payload, state) {
    let start = Date.now()

    if (lodash.isUndefined(payload.response.data)) {
        await payload.model.methods[payload.method](payload, state)
    }
    state.metrics.lifecycle.push({
        name: "method",
        ms: Date.now() - start,
    })
}

export default method
