import * as Mixin from "../../../mixin"
import { LifecycleFunction, Method } from "../../../../types"

const effect: LifecycleFunction<unknown, Method> = async function (payload, state) {
    const befores = Mixin.Before.bind[payload.method].effect
    const afters = Mixin.After.bind[payload.method].effect
    const effects = [...befores, ...payload.model.bind[payload.method].effect, ...afters]

    for (const effect of effects) {
        const start = Date.now()
        await effect(payload, state)

        state.metrics.lifecycle.push({
            name: effect.name,
            ms: Date.now() - start,
        })
    }
}

export default effect
