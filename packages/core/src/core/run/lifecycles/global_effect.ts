import { globalEffects } from "../../mixin"
import { Payload } from "../../payload"
import * as lodash from "lodash"
import { MethodResponse } from "../../response"
import { Model } from "../../model/model"
import { Method } from "../../method"

export default async function globalEffect<T extends Model, M extends Method>(
    payload: Payload<T, M>,
    response: MethodResponse<T>[M],
): Promise<void> {
    const promises = lodash.reverse(globalEffects).map(async (effect) => {
        await effect.execute(payload, response)
    })

    await Promise.all(promises)
}
