import { after } from "../../mixin/src/binds/after";
import { before } from "../../mixin/src/binds/before";
import { Payload } from "../../payload";

const effect = async function (payload: Payload<any, any>) {
    const effects = [
        ...before[payload.method].effect,
        ...payload.model.binds[payload.method].effect,
        ...after[payload.method].effect,
    ];

    for (const effect of effects) {
        const start = Date.now();
        await effect.execute(payload);

        payload.state.metrics.lifecycle.push({
            name: effect.key,
            ms: Date.now() - start,
        });
    }
};

export default effect;
