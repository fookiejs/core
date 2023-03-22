import * as lodash from "lodash"
import { models, run } from "../../../core"
import { Read, Delete, Create, Count } from "../../../method"
import { LifecycleFunction } from "../../../../types"

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
