import { After, Before } from "@fookie/mixin"
import { models } from "@fookie/core"
import * as lodash from "lodash"
import { LifecycleFunction } from "@fookie/core"

const preRule: LifecycleFunction = async function (payload, state) {
    if (!lodash.includes(models, payload.model)) {
        payload.response.error = "has_model"
        return false
    }
    if (!lodash.has(payload.model.methods, payload.method)) {
        payload.response.error = "has_method"
        return false
    }

    const befores = Before.bind[payload.method].preRule
    const afters = After.bind[payload.method].preRule
    const preRules = [...befores, ...payload.model.bind[payload.method].preRule, ...afters]

    for (let preRule of preRules) {
        const start = Date.now()
        const res = await preRule(payload, state)
        state.metrics.lifecycle.push({
            name: preRule.name,
            ms: Date.now() - start,
        })

        if (res === false) {
            payload.response.error = preRule.name
            return false
        }
    }
    return true
}

export default preRule
