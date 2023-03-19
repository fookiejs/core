import * as lodash from "lodash"
import { After, Before } from "../mixins"

export default async function (payload: PayloadInterface, state: StateInterface) {
    const befores = Before.bind[payload.method].role
    const afters = After.bind[payload.method].role

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
            let skip = false
            error = role.name
            if (
                lodash.has(field, "reject") &&
                lodash.has(field.reject, role.name) &&
                lodash.has(field.reject[role.name], "modify")
            ) {
                const modifies = payload.model.bind[payload.method]["reject"][role.name].modify
                for (const modify of modifies) {
                    await modify(payload, state)
                }
                skip = true || skip
            }

            if (
                lodash.has(field, "reject") &&
                lodash.has(field.reject, role.name) &&
                lodash.has(field.reject[role.name], "rule")
            ) {
                const extra_rules = payload.model.bind[payload.method]["reject"][role.name].rule
                for (const rule of extra_rules) {
                    const extra_rule_response = rule(payload, state)
                    if (!extra_rule_response) {
                        error = rule.name
                        break
                    }
                }
                skip = true || skip
            }

            if (skip && i === roles.length - 1) {
                return true
            }

            if (skip) {
                continue
            }
        }
    }

    payload.response.error = error
    return false
}
