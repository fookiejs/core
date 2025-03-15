import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"
import { Config } from "../../config"
import { Unique } from "../../field/field"

export default Rule.new({
    key: "unique",
    execute: async function (payload) {
        const trash_old = payload.method === "create" ? 0 : 1
        const fields = lodash.keys(payload.body)
        for (const field of fields) {
            if (lodash.includes(payload.model.schema()[field].features, Unique)) {
                const res = await payload.model.read(
                    {
                        filter: {
                            [field]: { equals: payload.body[field] },
                        },
                    },
                    { sub: Config.SYSTEM_TOKEN },
                )

                if (Array.isArray(res) && res.length > trash_old) {
                    return false
                }
            }
        }
        return true
    },
})
