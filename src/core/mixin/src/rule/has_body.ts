import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "has_body",
    execute: async function (payload) {
        return lodash.has(payload, "body");
    },
});
