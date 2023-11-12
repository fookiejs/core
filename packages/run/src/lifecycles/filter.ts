import * as Mixin from "../../../mixin"
import { LifecycleFunction, Method } from "../../../../types"

const filter: LifecycleFunction<unknown, Method> = async function (payload, state) {
    const befores = Mixin.before.bind[payload.method].filter
    const afters = Mixin.after.bind[payload.method].filter
    const filters = [...befores, ...payload.model.bind[payload.method].filter, ...afters]

    for (const filter of filters) {
        const start = Date.now()
        await filter(payload, state)
        state.metrics.lifecycle.push({
            name: filter.name,
            ms: Date.now() - start,
        })
    }
}

export default filter
