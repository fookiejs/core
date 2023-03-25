import * as lodash from "lodash"
import { v4 } from "uuid"
import { LifecycleFunction } from "../../../../types"

const defalut_payload: LifecycleFunction = async function (payload, state) {
    const newPayload = lodash.merge(payload, {
        options: {},
        body: {},
        query: {
            attributes: [],
        },
        id: v4().replace("-", ""),
    })

    for (const key in newPayload) {
        payload[key] = newPayload[key]
    }

    state.metrics = {
        lifecycle: [],
        start: Date.now(),
    }
    if (!payload.query.offset) {
        payload.query.offset = 0
    }
    if (!payload.query.limit) {
        payload.query.limit = Infinity
    }
    if (payload.query.attributes.length == 0) {
        payload.query.attributes = lodash.keys(payload.model.schema)
    }
}

export default defalut_payload
