import * as lodash from "lodash"

export default async function (payload, state) {
    let res = await ctx.run({
        token: "system_token",
        model: "mixin",
        method: "read",
        query: payload.query,
    })

    let mixins = res.data.map(function (mx) {
        return mx.name
    })
    let model_mixins = lodash.flatten(
        ctx.local.all("model").map(function (m) {
            return m.mixins
        })
    )

    if (lodash.intersection(model_mixins, mixins).length > 0) {
        return false
    }
    return true
}
