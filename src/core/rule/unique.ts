import * as lodash from "lodash"

export default async function (payload, state) {
    let trash_old = payload.method == "create" ? 0 : 1
    let model = payload.model
    let fields = lodash.keys(payload.body)
    for (let field of fields) {
        if (model.schema[field].unique) {
            let res = await ctx.run({
                token: process.env.SYSTEM_TOKEN,
                model: payload.model,
                method: "count",
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
