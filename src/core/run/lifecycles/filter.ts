import { after } from "../../mixin/src/binds/after"
import { before } from "../../mixin/src/binds/before"
import { Payload } from "../../payload"

const filter = async function (payload: Payload<any>, response: any): Promise<void> {
    const filters = [
        ...before[payload.method].filter,
        ...payload.model.binds[payload.method].filter,
        ...after[payload.method].filter,
    ]

    for (const filter of filters) {
        const start = Date.now()
        await filter.execute(payload, response)
        payload.state.metrics.lifecycle.push({
            name: filter.key,
            ms: Date.now() - start,
        })
    }
}

export default filter
