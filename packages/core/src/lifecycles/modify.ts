import { After, Before } from "../../../mixin"
import { LifecycleFunction } from "../../../../types"

const modify: LifecycleFunction = async function (payload, state) {
    const befores = Before.bind[payload.method].modify
    const afters = After.bind[payload.method].modify
    const modifies = [...befores, ...payload.model.bind[payload.method].modify, ...afters]

    for (const modify of modifies) {
        const start = Date.now()
        try {
            await modify(payload, state)
        } catch (error) {
            console.log(error)
        }
        state.metrics.lifecycle.push({
            name: modify.name,
            ms: Date.now() - start,
        })
    }
}
export default modify
