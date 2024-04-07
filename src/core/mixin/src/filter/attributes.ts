import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "attributes",
    execute: async function (payload) {
        if (payload.method === "read") {
            payload.response = payload.response.map((entity) =>
                lodash.pick(entity, payload.query.attributes),
            );
        }

        if (payload.method === "create") {
            payload.response = lodash.pick(payload.response, payload.query.attributes);
        }
    },
});
