import { After, Before } from "../../../mixin"
import { LifecycleFunction } from "../../../../types"

const filter: LifecycleFunction = async function (payload, state) {
    const befores = Before.bind[payload.method].filter
    const afters = After.bind[payload.method].filter
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
