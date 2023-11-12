import * as lodash from "lodash"
import { Dictionary } from "../../../dictionary"
import { LifecycleFunction, Method } from "../../../../types"
import * as Mixin from "../../../mixin"

const pre_rule: LifecycleFunction<unknown, Method> = async function (payload, state) {
    if (!lodash.includes(lodash.values(Dictionary.Model), payload.model)) {
        payload.response.error = "has_model"
        return false
    }
    if (!lodash.has(payload.model.methods, payload.method)) {
        payload.response.error = "has_method"
        return false
    }

    const befores = Mixin.before.bind[payload.method].pre_rule
    const afters = Mixin.after.bind[payload.method].pre_rule
    const pre_rules = [...befores, ...payload.model.bind[payload.method].pre_rule, ...afters]

    for (const pre_rule of pre_rules) {
        const start = Date.now()
        const res = await pre_rule(payload, state)
        state.metrics.lifecycle.push({
            name: pre_rule.name,
            ms: Date.now() - start,
        })

        if (res === false) {
            payload.response.error = pre_rule.name
            return false
        }
    }
    return true
}

export default pre_rule
