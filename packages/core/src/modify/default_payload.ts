import * as lodash from "lodash"
import { v4 } from "uuid"
import { models, run } from "@fookie/core"
import { Delete } from "@fookie/method"

const defalut_payload: LifecycleFunction = async function (payload, state) {
    const model = payload.model

    const newPayload = lodash.merge(payload, {
        options: {},
        body: {},
        query: {
            attributes: [],
        },
        id: v4().replace("-", ""),
    })

    for (let key in newPayload) {
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
        payload.query.limit = 0
    }
    if (payload.query.attributes.length == 0) {
        payload.query.attributes = lodash.keys(model.schema)
    }
}

export default defalut_payload
