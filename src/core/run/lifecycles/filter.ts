import { after } from "../../mixin/src/binds/after"
import { before } from "../../mixin/src/binds/before"
import { Payload } from "../../payload"

const filter = async function (payload: Payload<any, any>) {
    const filters = [
        ...before[payload.method].filter,
        ...payload.model.binds[payload.method].filter,
        ...after[payload.method].filter,
    ]

    for (const filter of filters) {
        const start = Date.now()
        await filter.execute(payload)
        payload.state.metrics.lifecycle.push({
            name: filter.key,
            ms: Date.now() - start,
        })
    }
}

export default filter
