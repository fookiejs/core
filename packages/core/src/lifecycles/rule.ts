import { LifecycleFunction } from "../../../../types"
import { After, Before } from "../../../mixin"

const rule: LifecycleFunction = async function (payload, state) {
    const befores = Before.bind[payload.method].rule
    const afters = After.bind[payload.method].rule
    const rules = [...befores, ...payload.model.bind[payload.method].rule, ...afters]

    for (const rule of rules) {
        const start = Date.now()
        const res = await rule(payload, state)
        state.metrics.lifecycle.push({
            name: rule.name,
            ms: Date.now() - start,
        })

        if (res === false) {
            payload.response.error = rule.name
            return false
        }
    }
    return true
}

export default rule
