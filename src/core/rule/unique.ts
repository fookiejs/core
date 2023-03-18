import * as lodash from "lodash"
import { v4 } from "uuid"
import { models, run } from "../.."
import { Count, Create, Delete, Read, Update } from "methods"

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
