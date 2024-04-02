import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "filter_fields",
    execute: async function (payload) {
        for (const field of payload.query.attributes) {
            const attr_roles = lodash.has(payload.schema[field], "read")
                ? payload.schema[field].read
                : [];
            let show = true;

            for (const role of attr_roles) {
                const res = await role(payload);
                show = show && !!res;
            }
            if (!show) {
                payload.query.attributes = lodash.pull(payload.query.attributes, field);
            }
        }
    },
});
