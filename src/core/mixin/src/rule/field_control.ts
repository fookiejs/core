import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "field_control",
    execute: async function (payload) {
        const fields = lodash.keys(payload.body);
        let res = true;
        for (const f of fields) {
            const field = payload.schema[f];
            const value = payload.body[f];
            if (lodash.isNumber(field.minimum)) {
                res = res && value >= field.minimum;
            }

            if (lodash.isNumber(field.maximum)) {
                res = res && value <= field.maximum;
            }

            if (lodash.isNumber(field.maximum_size)) {
                res = res && value.length <= field.maximum_size;
            }

            if (lodash.isNumber(field.minimum_size)) {
                res = res && value.length >= field.minimum_size;
            }
        }
        return res;
    },
});
