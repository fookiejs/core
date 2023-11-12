import * as lodash from "lodash"
import { LifecycleFunction, Method } from "../../../../types"

const method: LifecycleFunction<unknown, Method> = async function (payload, state) {
    const start = Date.now()

    if (lodash.isNull(payload.response.data)) {
        await payload.model.methods[payload.method](payload, state)
    }
    state.metrics.lifecycle.push({
        name: "method",
        ms: Date.now() - start,
    })
}

export default method
