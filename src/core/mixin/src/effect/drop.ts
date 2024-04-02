import { LifecycleFunction } from "../../../lifecycle-function";
import * as lodash from "lodash";

export default LifecycleFunction.new({
    key: "drop",
    execute: async function (payload) {
        if (lodash.has(payload.options, "drop")) {
            setTimeout(async function () {
                await run({
                    token: payload.token,
                    model: payload.model,
                    method: Delete,
                    query: {
                        filter: {
                            pk: { equals: payload.response.data[payload.model.database.pk] },
                        },
                    },
                });
            }, payload.options.drop);
        }
    },
});
