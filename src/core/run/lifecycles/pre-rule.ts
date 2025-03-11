import { Payload } from "../../payload"
import { FookieError } from "../../error"
import { globalRules } from "../../mixin/binds/global"
import { Method } from "../../method"
import { Model } from "../../model/model"

const preRule = async function (payload: Payload<Model, Method>): Promise<boolean> {
    for (const rule of globalRules) {
        const res = await rule.execute(payload)

        if (res !== true) {
            throw FookieError.new({
                description: "pre-rule",
                validationErrors: {},
                key: rule.key,
            })
        }
    }

    return true
}

export default preRule
