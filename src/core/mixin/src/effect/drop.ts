import { Config } from "../../../config";
import { LifecycleFunction } from "../../../lifecycle-function";
import * as lodash from "lodash";

export default LifecycleFunction.new({
    key: "drop",
    execute: async function (payload) {
        if (lodash.has(payload.options, "drop")) {
            if (payload.options.drop! > 0) {
                setTimeout(async function () {
                    await payload.modelClass.delete(
                        {
                            filter: {
                                id: { equals: payload.response.id },
                            },
                        },
                        {
                            token: Config.get("SYSTEM_TOKEN"),
                        },
                    );
                }, payload.options.drop);
            } else {
                await payload.modelClass.delete(
                    {
                        filter: {
                            id: { equals: payload.response.id },
                        },
                    },
                    {
                        token: Config.get("SYSTEM_TOKEN"),
                    },
                );
            }
        }
    },
});
