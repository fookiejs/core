import * as lodash from "lodash"
import { run } from "../../../core"
import { Create, Count } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const unique: LifecycleFunction = async function (payload) {
    const trash_old = payload.method === Create ? 0 : 1
    const fields = lodash.keys(payload.body)
    for (const field of fields) {
        if (payload.model.schema[field].unique) {
            const res = await run({
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
