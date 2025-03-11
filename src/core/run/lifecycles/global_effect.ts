import { globalEffects } from "../../mixin"
import { Payload } from "../../payload"
import * as lodash from "lodash"
import * as moment from "moment"
import { FookieResponse } from "../../response"
import { Model } from "../../model/model"
import { Method } from "../../method"

const globalEffect = async function (
    payload: Payload<Model, Method>,
    response?: FookieResponse<unknown>,
): Promise<void> {
    payload.state.metrics.end = moment.utc().toDate()

    const promises = lodash.reverse(globalEffects).map(async (effect) => {
        const start = Date.now()
        await effect.execute(payload, response)

        payload.state.metrics.lifecycle.push({
            name: effect.key,
            ms: Date.now() - start,
        })
    })

    await Promise.all(promises)
}

export default globalEffect
