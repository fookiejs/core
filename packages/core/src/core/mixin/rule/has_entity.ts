import { Config } from "../../config"
import { Rule } from "../../lifecycle-function"
import * as lodash from "lodash"
import { Method } from "../../method"
import { Model } from "../../model/model"

export default Rule.new<Model, Method>({
    key: "has_entity",
    execute: async function (payload) {
        for (const key of Object.keys(payload.body) as (keyof Model)[]) {
            if (lodash.has(payload.model.schema()[key], "relation")) {
                payload.model.schema()[key]
                const res = await payload.model.schema()[key].relation!.read(
                    {
                        filter: {
                            id: { equals: payload.body[key] },
                        },
                    },
                    {
                        sub: Config.SYSTEM_TOKEN,
                    },
                )

                if (Array.isArray(res) && res.length === 0) {
                    return false
                }
            }
        }
        return true
    },
})
