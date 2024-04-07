import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "can_write",
    execute: async function (payload) {
        const filtered_schema = lodash.pick(payload.schema, lodash.keys(payload.body));

        const writes = lodash.map(filtered_schema, function (i) {
            return i.write;
        });

        const filtered_writes = lodash.difference(writes, [undefined, null]);
        const roles = lodash.flatten(filtered_writes);

        for (const role of roles) {
            const res = await role.execute(payload);
            if (!res) {
                return false;
            }
        }

        return true;
    },
});
