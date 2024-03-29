import * as lodash from "lodash"
import { LifecycleFunction, Method } from "../../../../types"
import * as Mixin from "../../../mixin"

const rule: LifecycleFunction<unknown, Method> = async function (payload, state) {
    const befores = Mixin.before.bind[payload.method].rule
    const afters = Mixin.after.bind[payload.method].rule
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
