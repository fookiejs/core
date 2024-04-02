import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "only_server",
    execute: async function (payload) {
        const keys = lodash.keys(payload.schema);
        for (const key of keys) {
            if (payload.schema[key].only_server == true) {
                if (payload.body[key]) {
                    return false;
                }
            }
        }
        return true;
    },
});
