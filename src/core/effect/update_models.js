const deepMege = require("../../helpers/deepMerge")
module.exports = {
    name: "update_models",
    wait: true,
    function: async function (payload, ctx, state) {
        let model_res = await ctx.run({
            token: process.env.SYSTEM_TOKEN,
            model: "model",
            method: "read",
            query: {
                filter: {},
            },
        })
        let mixins_res = await ctx.run({
            token: process.env.SYSTEM_TOKEN,
            model: "mixin",
            method: "read",
            query: payload.query,
        })
        const models = model_res.data
        const mixins = mixins_res.data

        for (let model of models) {
            for (let mixin of mixins) {
                if (
                    ctx.lodash.intersection(
                        model.mixins,
                        mixins.map(function (mixin) { return mixin.name })
                    ).length > 0
                ) {
                    ctx.local.set("model", deepMege(model, mixin.object || {}))
                }
            }
        }
    },
}
