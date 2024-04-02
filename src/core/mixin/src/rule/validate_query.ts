import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "validate_query",
    execute: async function (payload) {
        const filter_keys = lodash.keys(payload.query.filter);
        const model_keys = lodash.keys(payload.schema);

        if (lodash.has(payload.query, "filter") && !lodash.isObject(payload.query.filter)) {
            return false;
        }
        if (lodash.has(payload.query, "limit") && !lodash.isNumber(payload.query.limit)) {
            return false;
        }
        if (lodash.has(payload.query, "offset") && !lodash.isNumber(payload.query.offset)) {
            return false;
        }
        if (lodash.difference(filter_keys, [...model_keys]).length > 0) {
            return false;
        }

        return true;
    },
});
