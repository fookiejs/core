import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";
import { Field } from "../../../field/field";
import { SchemaType } from "../../../schema";
import { Type } from "../../../type";

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

        for (const filter_key of filter_keys) {
            const type: Type = payload.schema[filter_key].type;
            const availableFilterKeys = lodash.keys(type.queryController);
            const currentKeys = lodash.keys(payload.query.filter[filter_key]);

            if (lodash.difference(currentKeys, availableFilterKeys).length !== 0) {
                return false;
            }
        }

        return true;
    },
});
