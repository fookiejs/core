import { after } from "../../mixin/binds/after"
import { before } from "../../mixin/binds/before"
import { Payload } from "../../payload"
import { Model } from "../../model/model"
import { Method } from "../../method"
import { MethodResponse } from "../../response"

export default async function filter<T extends Model, M extends Method>(
    payload: Payload<T, M>,
    response: MethodResponse<T>[M],
) {
    const filters = [
        ...before[payload.method].filter,
        ...payload.model.binds()[payload.method].filter,
        ...after[payload.method].filter,
    ]

    for (const filter of filters) {
        await filter.execute(payload, response)
    }
}
