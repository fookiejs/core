import * as lodash from "lodash"
import { LifecycleFunction } from "../../../lifecycle-function"
import { Config } from "../../../config"

export default LifecycleFunction.new({
    key: "unique",
    execute: async function (payload) {
        const trash_old = payload.method === "create" ? 0 : 1
        const fields = lodash.keys(payload.body)
        for (const field of fields) {
            if (payload.schema[field].unique) {
                const res = await payload.modelClass.count(
                    {
                        filter: {
                            [field]: { equals: payload.body[field] },
                        },
                    },
                    { token: Config.get("SYSTEM_TOKEN") },
                )

                if (res > trash_old) {
                    return false
                }
            }
        }
        return true
    },
})
