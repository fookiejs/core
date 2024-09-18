import { Payload } from "../../payload"
import { FookieError } from "../../error"
import { globalRules } from "../../mixin/binds/global"
import * as moment from "moment"

const preRule = async function (payload: Payload<any>, error: FookieError): Promise<boolean> {
    for (const rules of globalRules) {
        payload.state.metrics.end = moment.utc().toDate()

        const start = Date.now()

        const res = await rules.execute(payload, error)

        payload.state.metrics.lifecycle.push({
            name: rules.key,
            ms: Date.now() - start,
        })

        if (res === false) {
            error.key = rules.key
            return false
        }
    }

    return true
}

export default preRule
