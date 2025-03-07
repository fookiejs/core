import { Config } from "../../config"
import { Rule } from "../../lifecycle-function"
import * as lodash from "lodash"

export default Rule.new({
    key: "has_entity",
    execute: async function (payload) {
        for (const key of lodash.keys(payload.body)) {
            if (lodash.has(payload.model.schema()[key], "relation")) {
                const res = await payload.model.schema()[key].relation.count(
                    {
                        filter: {
                            id: { equals: payload.body[key] },
                        },
                    },
                    {
                        token: Config.SYSTEM_TOKEN,
                    },
                )

                if (res === 0) {
                    return false
                }
            }
        }
        return true
    },
})
