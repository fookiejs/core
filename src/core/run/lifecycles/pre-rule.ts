import { Payload } from "../../payload.ts";
import { after, before } from "../../mixin/index.ts";

const preRule = async function (payload: Payload<any, any>) {
    const allPreRules = [
        ...before[payload.method].preRule,
        ...payload.model.binds[payload.method].preRule,
        ...after[payload.method].preRule,
    ];

    for (const preRule of allPreRules) {
        const start = Date.now();

        const res = await preRule.execute(payload);

        payload.state.metrics.lifecycle.push({
            name: preRule.key,
            ms: Date.now() - start,
        });

        if (res === false) {
            payload.error.key = preRule.key;
            return false;
        }
    }

    return true;
};

export default preRule;
