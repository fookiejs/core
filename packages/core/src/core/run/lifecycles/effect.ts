import { after } from "../../mixin/binds/after"
import { before } from "../../mixin/binds/before"
import { Payload } from "../../payload"
import { Model } from "../../model/model"
import { Method } from "../../method"
import { MethodResponse } from "../../response"

export default async function effect<T extends Model, M extends Method>(
    payload: Payload<T, M>,
    response: MethodResponse<T>[M],
) {
    const effects = [
        ...before[payload.method].effect,
        ...payload.model.binds()[payload.method].effect,
        ...after[payload.method].effect,
    ]

    const promises = effects.map(async (effect) => {
        await effect.execute(payload, response)
    })

    await Promise.all(promises)
}
