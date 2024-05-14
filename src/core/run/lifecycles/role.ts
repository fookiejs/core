import * as lodash from "lodash";
import { Payload } from "../../payload.ts";
import { before } from "../../mixin/src/binds/before.ts";
import { after } from "../../mixin/src/binds/after.ts";

const role = async function (payload: Payload<any, any>) {
    const roles = [
        ...before[payload.method].role,
        ...payload.model.binds[payload.method].role,
        ...after[payload.method].role,
    ];

    let error = null;

    if (roles.length === 0) {
        return true;
    }

    for (let i = 0; i < roles.length; i++) {
        const role = roles[i];

        const res = await role.execute(payload);
        const field = payload.model.binds[payload.method];
        if (res) {
            if (lodash.has(field, `accept.${role.key}.modify`)) {
                const modifies = payload.model.binds[payload.method].accept[role.key].modify!;
                for (const modify of modifies) {
                    await modify.execute(payload);
                }
            }

            if (lodash.has(field, `accept.${role.key}.rule`)) {
                const extra_rules = payload.model.binds[payload.method]["accept"][role.key].rule!;
                for (const rule of extra_rules) {
                    const extra_rule_response = await rule.execute(payload);
                    if (!extra_rule_response) {
                        payload.error.key = rule.key;
                        return false;
                    }
                }
            }
            return true;
        } else {
            if (lodash.has(field, "reject") && lodash.has(field.reject, role.key)) {
                if (lodash.has(field.reject[role.key], "modify")) {
                    const modifies =
                        payload.model.binds[payload.method]["reject"][role.key].modify!;
                    for (const modify of modifies) {
                        await modify.execute(payload);
                    }
                }

                if (lodash.has(field.reject[role.key], "rule")) {
                    const extra_rules =
                        payload.model.binds[payload.method]["reject"][role.key].rule!;
                    for (const rule of extra_rules) {
                        const extra_rule_response = await rule.execute(payload);
                        if (!extra_rule_response) {
                            error = rule.key;
                            return false;
                        }
                    }
                }

                return true;
            }
            error = role.key;
        }
    }

    payload.error.key = error;

    return false;
};

export default role;