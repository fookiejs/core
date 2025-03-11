import * as lodash from "lodash"
import { Payload } from "../../payload"
import { before } from "../../mixin/binds/before"
import { after } from "../../mixin/binds/after"
import { FookieError } from "../../error"
import { BindsTypeField, Model } from "../../model/model"
import { Method } from "../../method"

const role = async function (payload: Payload<Model, Method>) {
    const roles = [
        ...before[payload.method].role,
        ...payload.model.binds()[payload.method].role,
        ...after[payload.method].role,
    ]

    if (roles.length === 0) {
        return true
    }

    for (let i = 0; i < roles.length; i++) {
        const role = roles[i]
        const res = await role.execute(payload)
        const field = payload.model.binds()[payload.method] as BindsTypeField

        if (res) {
            const extra_rule_responses: boolean[] = []

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
                const extra_rule_response = await rule.execute(payload)
                extra_rule_responses.push(extra_rule_response)
            }

            if (extra_rule_responses.includes(false)) {
                throw FookieError.new({
                    description: "accepts:extra_rule",
                    validationErrors: {},
                    key: role.key,
                })
            }

            break
        } else {
            const extra_rule_responses: boolean[] = []

            const modifies = lodash.flatten(
                field.rejects.filter((r) => r[0] === role)?.map((item) => item[1].modify),
            )

            for (const modify of modifies) {
                await modify.execute(payload)
            }

            if (modifies.length > 0) {
                extra_rule_responses.push(true)
            }

            const extra_rules = lodash.flatten(
                field.rejects.filter((r) => r[0] === role)?.map((item) => item[1].rule),
            )

            for (const rule of extra_rules) {
                const extra_rule_response = await rule.execute(payload)
                extra_rule_responses.push(extra_rule_response)
            }

            if (extra_rule_responses.includes(false) || extra_rule_responses.length === 0) {
                throw FookieError.new({
                    description: "rejects:extra_rule",
                    validationErrors: {},
                    key: role.key,
                })
            }

            if (extra_rule_responses.length === 0) {
                break
            }
        }
    }

    return true
}

export default role
