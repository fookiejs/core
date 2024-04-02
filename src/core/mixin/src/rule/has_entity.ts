import { LifecycleFunction } from "../../../lifecycle-function";
import * as lodash from "lodash";

export default LifecycleFunction.new({
    key: "has_entity",
    execute: async function (payload) {
        for (const key of lodash.keys(payload.body)) {
            if (lodash.has(payload.schema[key], "relation")) {
                const res = await run({
                    token: process.env.SYSTEM_TOKEN,
                    model: payload.schema[key].relation,
                    method: Count,
                    query: {
                        filter: {
                            pk: { equals: payload.body[key] },
                        },
                    },
                });
                if (res.data === 0) {
                    return false;
                }
            }
        }
        return true;
    },
});
