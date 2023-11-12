import * as lodash from "lodash"
import { run } from "../../../run"
import { Count } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const has_entity: LifecycleFunction<unknown, any> = async function (payload) {
    for (const key of lodash.keys(payload.body)) {
        if (lodash.has(payload.model.schema[key], "relation")) {
            const res = await run({
                token: process.env.SYSTEM_TOKEN,
                model: payload.model.schema[key].relation,
                method: Count,
                query: {
                    filter: {
                        pk: { equals: payload.body[key] },
                    },
                },
            })
            if (res.data === 0) {
                return false
            }
        }
    }
    return true
}

export default has_entity
