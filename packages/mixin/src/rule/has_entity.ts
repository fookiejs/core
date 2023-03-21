import * as lodash from "lodash"
import { models, run } from "@fookie/core"
import { Count, Delete, Read, Update } from "@fookie/method"
import { LifecycleFunction } from "@fookie/core"

const has_entity: LifecycleFunction = async function (payload, state) {
    for (let key of lodash.keys(payload.body)) {
        if (lodash.has(payload.model.schema[key], "relation")) {
            const res = await run({
                token: process.env.SYSTEM_TOKEN,
                model: payload.model.schema[key].relation,
                method: Count,
                query: {
                    filter: {
                        pk: payload.body[key],
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