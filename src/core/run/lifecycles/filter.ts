import { after } from "../../mixin/binds/after"
import { before } from "../../mixin/binds/before"
import { Payload } from "../../payload"
import * as moment from "moment"

const filter = async function (payload: Payload<any>, response: any): Promise<void> {
    const filters = [
        ...before[payload.method].filter,
        ...payload.modelClass.binds()[payload.method].filter,
        ...after[payload.method].filter,
    ]

    for (const filter of filters) {
        payload.state.metrics.end = moment.utc().toDate()

        const start = Date.now()
        await filter.execute(payload, response)
        payload.state.metrics.lifecycle.push({
            name: filter.key,
            ms: Date.now() - start,
        })
    }
}

export default filter
