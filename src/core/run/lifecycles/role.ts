import * as lodash from "lodash"
import { Payload } from "../../payload"
import { before } from "../../mixin/binds/before"
import { after } from "../../mixin/binds/after"
import { FookieError } from "../../error"
import * as moment from "moment"

const role = async function (payload: Payload<any>, error: FookieError) {
    const roles = [
        ...before[payload.method].role,
        ...payload.modelClass.binds()[payload.method].role,
        ...after[payload.method].role,
    ]

    if (roles.length === 0) {
        return true
    }

    for (let i = 0; i < roles.length; i++) {
        payload.state.metrics.end = moment.utc().toDate()

        const role = roles[i]

        const res = await role.execute(payload, error)
        const field = payload.modelClass.binds()[payload.method]
        if (res) {
            if (lodash.has(field, `accept.${role.key}.modify`)) {
                const modifies =
                    payload.modelClass.binds()[payload.method].accept![role.key].modify!
                for (const modify of modifies) {
                    await modify.execute(payload)
                }
            }

            if (lodash.has(field, `accept.${role.key}.rule`)) {
                const extra_rules =
                    payload.modelClass.binds()[payload.method]["accept"]![role.key].rule!
                for (const rule of extra_rules) {
                    const extra_rule_response = await rule.execute(payload, error)
                    if (!extra_rule_response) {
                        error.key = rule.key
                        return false
                    }
                }
            }
            return true
        } else {
            if (lodash.has(field, "reject") && lodash.has(field.reject, role.key)) {
                if (lodash.has(field.reject![role.key], "modify")) {
                    const modifies =
                        payload.modelClass.binds()[payload.method]["reject"]![role.key].modify!
                    for (const modify of modifies) {
                        await modify.execute(payload)
                    }
                }

                if (lodash.has(field.reject![role.key], "rule")) {
                    const extra_rules =
                        payload.modelClass.binds()[payload.method]["reject"]![role.key].rule!
                    for (const rule of extra_rules) {
                        const extra_rule_response = await rule.execute(payload, error)
                        if (!extra_rule_response) {
                            error.key = rule.key
                            return false
                        }
                    }
                }

                return true
            }
            error.key = role.key
        }
    }

    return false
}

export default role
