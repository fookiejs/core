import { After, Before } from "@fookie/mixin"

export default async function (payload: PayloadInterface, state: StateInterface) {
    const befores = Before.bind[payload.method].effect
    const afters = After.bind[payload.method].effect
    const effects = [...befores, ...payload.model.bind[payload.method].effect, ...afters]

    for (const effect of effects) {
        let start = Date.now()
        await effect(payload, state)

        state.metrics.lifecycle.push({
            name: effect.name,
            ms: Date.now() - start,
        })
    }
}
