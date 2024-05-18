import { after } from "../../mixin/src/binds/after"
import { before } from "../../mixin/src/binds/before"
import { Payload } from "../../payload"

const rule = async function (payload: Payload<any, any>) {
    const rules = [
        ...before[payload.method]!.rule!,
        ...payload.model.binds[payload.method].rule,
        ...after[payload.method].rule,
    ]

    for (const rule of rules) {
        const start = Date.now()
        const res = await rule.execute(payload)
        payload.state.metrics.lifecycle.push({
            name: rule.key,
            ms: Date.now() - start,
        })

        if (res === false) {
            payload.error.key = rule.key
            return false
        }
    }
    return true
}

export default rule
