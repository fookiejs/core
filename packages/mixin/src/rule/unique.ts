import * as lodash from "lodash"
import { models, run } from "@fookie/core"
import { Count, Create, Delete, Read, Update } from "@fookie/method"
import { LifecycleFunction } from "@fookie/core"

const unique: LifecycleFunction = async function (payload, state) {
    let trash_old = payload.method === Create ? 0 : 1
    let fields = lodash.keys(payload.body)
    for (let field of fields) {
        if (payload.model.schema[field].unique) {
            let res = await run({
                token: process.env.SYSTEM_TOKEN,
                model: payload.model,
                method: Count,
                query: {
                    filter: {
                        [field]: payload.body[field],
                    },
                },
            })
            if (res.data > trash_old) {
                return false
            }
        }
    }
    return true
}
export default unique
