import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"
import { Config } from "../../config"

export default Rule.new({
    key: "uniqueGroup",
    execute: async function (payload) {
        const fields = lodash.keys(payload.body)
        let groups = []
        for (const field of fields) {
            if (payload.model.schema()[field].uniqueGroup) {
                groups = lodash.uniq(groups.concat(payload.model.schema()[field].uniqueGroup))
            }
        }

        for (const group of groups) {
            const filter = {}
            for (const field of lodash.keys(payload.model.schema())) {
                if (
                    payload.model.schema()[field].uniqueGroup &&
                    payload.model.schema()[field].uniqueGroup.includes(group) &&
                    payload.body[field]
                ) {
                    filter[field] = { equals: payload.body[field] }
                }
            }

            const res = await payload.model.read(
                {
                    filter,
                },
                {
                    sub: Config.SYSTEM_TOKEN,
                },
            )

            return Array.isArray(res) && res.length == 0
        }

        return true
    },
})
