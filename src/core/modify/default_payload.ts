import * as lodash from "lodash"
import { v4 } from "uuid"

export default async function (payload, state) {
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
        response: 0,
        start: Date.now(),
    }
    if (!payload.query.offset) {
        payload.query.offset = 0
    }
    if (!payload.query.limit) {
        payload.query.limit = 0
    }
    if (payload.query.attributes.length == 0) {
        payload.query.attributes = lodash.keys(model.schema) //TODO eğer model yoksa patlıyor.
    }
}
