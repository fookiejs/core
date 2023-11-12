import * as lodash from "lodash"
import { run } from "../../../run"
import { Create, Count } from "../../../method"
import { LifecycleFunction, Method } from "../../../../types"

const unique: LifecycleFunction<unknown, Method> = async function (payload) {
    const trash_old = payload.method === Create ? 0 : 1
    const fields = lodash.keys(payload.body)
    for (const field of fields) {
        if (payload.model.schema[field].unique) {
            const res = await run<any, "count">({
                token: process.env.SYSTEM_TOKEN,
                model: payload.model,
                method: Count,
                query: {
                    filter: {
                        [field]: { equals: payload.body[field] },
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
