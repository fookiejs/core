import { after } from "../../mixin/binds/after"
import { before } from "../../mixin/binds/before"
import { Payload } from "../../payload"
import * as moment from "moment"
import { FookieResponse } from "../../response"
import { Model } from "../../model/model"
import { Method } from "../../method"

const effect = async function (
    payload: Payload<Model, Method>,
    response: FookieResponse<unknown>,
): Promise<void> {
    const effects = [
        ...before[payload.method].effect,
        ...payload.model.binds()[payload.method].effect,
        ...after[payload.method].effect,
    ]

    const promises = effects.map(async (effect) => {
        payload.state.metrics.end = moment.utc().toDate()

        const start = Date.now()
        await effect.execute(payload, response)

        payload.state.metrics.lifecycle.push({
            name: effect.key,
            ms: Date.now() - start,
        })
    })

    await Promise.all(promises)
}

export default effect
