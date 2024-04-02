import { after } from "../../mixin/src/binds/after.ts";
import { before } from "../../mixin/src/binds/before.ts";
import { Payload } from "../../payload.ts";

const modify = async function (payload: Payload<any, any>) {
    const modifies = [
        ...before[payload.method].modify,
        ...payload.model.binds[payload.method].modify,
        ...after[payload.method].modify,
    ];

    for (const modify of modifies) {
        const start = Date.now();
        try {
            await modify.execute(payload);
        } catch (error) {}
        payload.state.metrics.lifecycle.push({
            name: modify.key,
            ms: Date.now() - start,
        });
    }
};
export default modify;
