import { FookieError } from "../../error"
import { after } from "../../mixin/binds/after"
import { before } from "../../mixin/binds/before"
import { Payload } from "../../payload"
import * as moment from "moment"
import { Method } from "../../method"
import { Model } from "../../model/model"

const rule = async function (
    payload: Payload<Model, Method>,
    error: FookieError,
): Promise<boolean> {
    const rules = [
        ...before[payload.method].rule,
        ...payload.model.binds()![payload.method].rule,
        ...after[payload.method].rule,
    ]

    for (const rule of rules) {
        payload.state.metrics.end = moment.utc().toDate()

        const start = Date.now()
        const res = await rule.execute(payload, error)
        payload.state.metrics.lifecycle.push({
            name: rule.key,
            ms: Date.now() - start,
        })

        if (res === false) {
            error.key = rule.key
            return false
        }
    }
    return true
}

export default rule
