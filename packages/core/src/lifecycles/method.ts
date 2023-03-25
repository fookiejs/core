import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const method: LifecycleFunction = async function (payload, state) {
    const start = Date.now()

    if (lodash.isUndefined(payload.response.data)) {
        await payload.model.methods[payload.method](payload, state)
    }
    state.metrics.lifecycle.push({
        name: "method",
        ms: Date.now() - start,
    })
}

export default method
