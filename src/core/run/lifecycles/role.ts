import * as lodash from "lodash"
import { Payload } from "../../payload"
import { before } from "../../mixin/binds/before"
import { after } from "../../mixin/binds/after"
import { FookieError } from "../../error"
import * as moment from "moment"
import { BindsTypeField, Model } from "../../model/model"
import { Method } from "../../method"

const role = async function (payload: Payload<Model, Method>, error: FookieError) {
    const roles = [
        ...before[payload.method].role,
        ...payload.model.binds()[payload.method].role,
        ...after[payload.method].role,
    ]

    if (roles.length === 0) {
        return true
    }

    for (let i = 0; i < roles.length; i++) {
        payload.state.metrics.end = moment.utc().toDate()

        const role = roles[i]
        const res = await role.execute(payload, error)
        const field = payload.model.binds()[payload.method] as BindsTypeField

        if (res) {
            const modifies = lodash.flatten(
                field.accepts.filter((r) => r[0] === role)?.map((item) => item[1].modify),
            )

            for (const modify of modifies) {
                await modify.execute(payload)
            }

            const extra_rules = lodash.flatten(
                field.accepts.filter((r) => r[0] === role)?.map((item) => item[1].rule),
            )

            for (const rule of extra_rules) {
                const extra_rule_response = await rule.execute(payload, error)
                if (!extra_rule_response) {
                    error.key = rule.key
                    return false
                }
            }

            break
        } else {
            let pass = false

            const modifies = lodash.flatten(
                field.rejects.filter((r) => r[0] === role)?.map((item) => item[1].modify),
            )
            for (const modify of modifies) {
                await modify.execute(payload)
            }

            const extra_rules = lodash.flatten(
                field.rejects.filter((r) => r[0] === role)?.map((item) => item[1].rule),
            )

            for (const rule of extra_rules) {
                const extra_rule_response = await rule.execute(payload, error)
                if (extra_rule_response) {
                    pass = true || pass
                }
            }
            error.key = role.key

            return pass
        }
    }

    return true
}

export default role
