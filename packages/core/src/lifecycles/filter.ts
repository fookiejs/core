import { After, Before } from "@fookie/mixin"
import { LifecycleFunction, PayloadInterface, StateInterface } from "@fookie/core"

const filter: LifecycleFunction = async function (payload: PayloadInterface, state: StateInterface) {
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
