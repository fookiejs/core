import { after } from "../../mixin/binds/after"
import { before } from "../../mixin/binds/before"
import { Payload } from "../../payload"
import { FookieResponse } from "../../response"
import { Model } from "../../model/model"
import { Method } from "../../method"

const filter = async function (
    payload: Payload<Model, Method>,
    response: FookieResponse<unknown>,
): Promise<void> {
    const filters = [
        ...before[payload.method].filter,
        ...payload.model.binds()[payload.method].filter,
        ...after[payload.method].filter,
    ]

    for (const filter of filters) {
        await filter.execute(payload, response)
    }
}

export default filter
