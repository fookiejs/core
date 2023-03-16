module.exports = {
    name: "set_default_modify",
    wait: true,
    function: async function (payload, ctx, state) {
        let keys = ctx.lodash.keys(ctx.local.get("model", payload.model).schema)
        keys = keys.filter(function (k) { return ctx.local.get("model", payload.model).schema[k].default })
        keys.forEach(async function (k) {
            const modify = await ctx.run({
                token: process.env.SYSTEM_TOKEN,
                model: "lifecycle",
                method: "read",
                query: {
                    filter: {
                        name: ctx.local.get("model", payload.model).schema[k]
                            .default,
                    },
                },
            })
            if (payload.body[k] == undefined) {
                payload.body[k] = modify[0](payload, ctx, state)
            }
        })
    },
}
