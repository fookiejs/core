import * as lodash from "lodash"
import { run } from "../../"

export default async function (payload, state) {
    let model = payload.model
    let keys = lodash.keys(payload.body)
    for (let key of keys) {
        if (lodash.has(model.schema[key], "relation")) {
            let res = await run({
                token: process.env.SYSTEM_TOKEN,
                model: model.schema[key].relation,
                method: "count",
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
