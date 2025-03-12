import { globalEffects } from "../../mixin"
import { Payload } from "../../payload"
import * as lodash from "lodash"
import { FookieResponse } from "../../response"
import { Model } from "../../model/model"
import { Method } from "../../method"

const globalEffect = async function (
    payload: Payload<Model, Method>,
    response?: FookieResponse<unknown>,
): Promise<void> {
    const promises = lodash.reverse(globalEffects).map(async (effect) => {
        await effect.execute(payload, response)
    })

    await Promise.all(promises)
}

export default globalEffect
