import { lifecycle } from "../.."

export default async function (payload, state) {
    let res = await ctx.run({
        token: process.env.SYSTEM_TOKEN,
        model: "mixin",
        method: "read",
        query: payload.query,
    })

    let mixins = res.data.map(function (mx) {
        return mx.name
    })
    let model_mixins = ctx.lodash.flatten(
        ctx.local.all("model").map(function (m) {
            return m.mixins
        })
    )

    if (ctx.lodash.intersection(model_mixins, mixins).length > 0) {
        return false
    }
    return true
}
