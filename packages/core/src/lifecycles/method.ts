import * as lodash from "lodash"
import { LifecycleFunction, PayloadInterface, StateInterface } from "@fookie/core"

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
