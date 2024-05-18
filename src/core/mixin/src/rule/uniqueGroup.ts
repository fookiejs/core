import * as lodash from "lodash"
import { LifecycleFunction } from "../../../lifecycle-function"
import { Config } from "../../../config"

export default LifecycleFunction.new({
    key: "uniqueGroup",
    execute: async function (payload) {
        const fields = lodash.keys(payload.body)
        let groups = []
        for (const field of fields) {
            if (payload.schema[field].uniqueGroup) {
                groups = lodash.uniq(groups.concat(payload.schema[field].uniqueGroup))
            }
        }

        for (const group of groups) {
            const filter = {}
            for (const field of lodash.keys(payload.schema)) {
                if (
                    payload.schema[field].uniqueGroup &&
                    payload.schema[field].uniqueGroup.includes(group) &&
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
