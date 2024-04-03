import { LifecycleFunction } from "../../../lifecycle-function";
import * as lodash from "lodash";

export default LifecycleFunction.new({
    key: "has_entity",
    execute: async function (payload) {
        for (const key of lodash.keys(payload.body)) {
            if (lodash.has(payload.schema[key], "relation")) {
                const res = await payload.schema[key].relation.count({
                    filter: {
                        id: { equals: payload.body[key] },
                    },
                });

                if (res === 0) {
                    return false;
                }
            }
        }
        return true;
    },
});
