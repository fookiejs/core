import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"
import { Config } from "../../config"

export default Rule.new({
    key: "uniqueGroup",
    execute: async function (payload) {
        const fields = lodash.keys(payload.body)
        let groups = []
        for (const field of fields) {
            if (payload.modelClass.schema()[field].uniqueGroup) {
                groups = lodash.uniq(groups.concat(payload.modelClass.schema()[field].uniqueGroup))
            }
        }

        for (const group of groups) {
            const filter = {}
            for (const field of lodash.keys(payload.modelClass.schema())) {
                if (
                    payload.modelClass.schema()[field].uniqueGroup &&
                    payload.modelClass.schema()[field].uniqueGroup.includes(group) &&
                    payload.body[field]
                ) {
                    filter[field] = { equals: payload.body[field] }
                }
            }

            const res = await payload.modelClass.count(
                {
                    filter,
                },
                {
                    token: Config.get("SYSTEM_TOKEN"),
                },
            )

            return res == 0
        }

        return true
    },
})
