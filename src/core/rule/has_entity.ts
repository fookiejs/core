import { lifecycle } from "../.."

export default async function (payload, state) {
    let model = ctx.local.get("model", payload.model)
    let keys = ctx.lodash.keys(payload.body)
    for (let key of keys) {
        if (ctx.lodash.has(model.schema[key], "relation")) {
            let res = await ctx.run({
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
