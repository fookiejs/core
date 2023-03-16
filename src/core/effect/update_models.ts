import * as lodash from "lodash"

export default async function (payload, state) {
    let model_res = await ctx.run({
        token: "system_token",
        model: "model",
        method: "read",
        query: {
            filter: {},
        },
    })
    let mixins_res = await ctx.run({
        token: "system_token",
        model: "mixin",
        method: "read",
        query: payload.query,
    })
    const models = model_res.data
    const mixins = mixins_res.data

    for (let model of models) {
        for (let mixin of mixins) {
            if (
                lodash.intersection(
                    model.mixins,
                    mixins.map(function (mixin) {
                        return mixin.name
                    })
                ).length > 0
            ) {
                ctx.local.set("model", deepMege(model, mixin.object || {}))
            }
        }
    }
}
