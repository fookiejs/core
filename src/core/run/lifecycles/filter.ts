import { LifecycleFunction } from "../../lifecycle-function.ts";
import { after } from "../../mixin/src/binds/after.ts";
import { before } from "../../mixin/src/binds/before.ts";
import { Payload } from "../../payload.ts";

const filter = async function (payload: Payload<any, any>) {
    const filters = [
        ...before[payload.method].filter,
        ...payload.model.binds[payload.method].filter,
        ...after[payload.method].filter,
    ];

    for (const filter of filters) {
        const start = Date.now();
        await filter.execute(payload);
        payload.state.metrics.lifecycle.push({
            name: filter.key,
            ms: Date.now() - start,
        });
    }
};

export default filter;
