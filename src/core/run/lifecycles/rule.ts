import { FookieError } from "../../error"
import { after } from "../../mixin/binds/after"
import { before } from "../../mixin/binds/before"
import { Payload } from "../../payload"
import { Method } from "../../method"
import { Model } from "../../model/model"

const rule = async function (payload: Payload<Model, Method>): Promise<boolean> {
    const rules = [
        ...before[payload.method].rule,
        ...payload.model.binds()![payload.method].rule,
        ...after[payload.method].rule,
    ]

    for (const rule of rules) {
        const res = await rule.execute(payload)

        if (res !== true) {
            throw FookieError.new({
                key: rule.key,
                validationErrors: {},
                description: "",
            })
        }
    }
    return true
}

export default rule
