import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "only_client",
    execute: async function (payload) {
        const search = ["", null, undefined];
        const keys = lodash.keys(payload.schema);
        for (const key of keys) {
            if (payload.schema[key].only_client == true) {
                if (search.includes(payload.body[key])) {
                    return false;
                }
            }
        }
        return true;
    },
});
