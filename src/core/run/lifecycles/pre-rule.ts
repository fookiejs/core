import { Payload } from "../../payload"
import { FookieError } from "../../error"
import { preRules } from "../../mixin/binds/global"

const preRule = async function (payload: Payload<any>, error: FookieError): Promise<boolean> {
    for (const preRule of preRules) {
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
