import { After, Before } from "@fookie/mixin"
import { models } from "../index"
import * as lodash from "lodash"

export default async function (payload: PayloadInterface, state: StateInterface) {
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
