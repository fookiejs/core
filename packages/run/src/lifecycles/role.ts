import * as lodash from "lodash"
import Model from "../../../model"
import { LifecycleFunction } from "../../../../types"
import * as Mixin from "../../../mixin"

const role: LifecycleFunction = async function (payload, state) {
    const befores = Mixin.Before.bind[payload.method].role
    const afters = Mixin.After.bind[payload.method].role

    const roles = [...befores, ...payload.model.bind[payload.method].role, ...afters]

    let error = null

    if (roles.length === 0) {
        return true
    }

    for (let i = 0; i < roles.length; i++) {
        const role = roles[i]

        const res = await role(payload, state)
        const field = payload.model.bind[payload.method]
        if (res) {
            if (lodash.has(field, `accept.${role.name}.modify`)) {
                const modifies = payload.model.bind[payload.method].accept[role.name].modify
                for (const modify of modifies) {
                    await modify(payload, state)
                }
            }

            if (lodash.has(field, `accept.${role.name}.rule`)) {
                const extra_rules = payload.model.bind[payload.method]["accept"][role.name].rule
                for (const rule of extra_rules) {
                    const extra_rule_response = await rule(payload, state)
                    if (!extra_rule_response) {
                        payload.response.error = rule.name
                        return false
                    }
                }
            }
            return true
        } else {
            if (lodash.has(field, "reject") && lodash.has(field.reject, role.name)) {
                if (lodash.has(field.reject[role.name], "modify")) {
                    const modifies = payload.model.bind[payload.method]["reject"][role.name].modify
                    for (const modify of modifies) {
                        await modify(payload, state)
                    }
                }

                if (lodash.has(field.reject[role.name], "rule")) {
                    const extra_rules = payload.model.bind[payload.method]["reject"][role.name].rule
                    for (const rule of extra_rules) {
                        const extra_rule_response = await rule(payload, state)
                        if (!extra_rule_response) {
                            error = rule.name
                            return false
                        }
                    }
                }

                return true
            }
            error = role.name
        }
    }

    payload.response.error = error
    return false
}

export default role
