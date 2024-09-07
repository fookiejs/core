import { Payload } from "../../payload"
import { after, before } from "../../mixin/index"
import { FookieError } from "../../error"

const preRule = async function (payload: Payload<any>, error: FookieError): Promise<boolean> {
    const allPreRules = [
        ...before[payload.method].preRule,
        ...payload.model.binds[payload.method].preRule,
        ...after[payload.method].preRule,
    ]

    for (const preRule of allPreRules) {
        const start = Date.now()

        const res = await preRule.execute(payload, error)

        payload.state.metrics.lifecycle.push({
            name: preRule.key,
            ms: Date.now() - start,
        })

        if (res === false) {
            error.key = preRule.key
            return false
        }
    }

    return true
}

export default preRule
