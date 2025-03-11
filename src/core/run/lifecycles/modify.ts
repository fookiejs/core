import { after } from "../../mixin/binds/after"
import { before } from "../../mixin/binds/before"
import { Payload } from "../../payload"
import { Method } from "../../method"
import { Model } from "../../model/model"

const modify = async function (payload: Payload<Model, Method>): Promise<void> {
    const modifies = [
        ...before[payload.method].modify,
        ...payload.model.binds()[payload.method].modify,
        ...after[payload.method].modify,
    ]

    for (const modify of modifies) {
        try {
            await modify.execute(payload)
        } catch (error) {}
    }
}
export default modify
