module.exports = {
    name: "reactive_prepare",
    wait: true,
    function: async function (payload, ctx, state) {
        let result = []
        const entites = await ctx.remote.all(payload.model, payload.query)
        const schema = state.model.schema
        const has = ctx.lodash.has
        for (const f in schema) {
            if (
                has(schema[f], "reactive_delete") &&
                !!schema[f].reactive_delete
            ) {
                for (const e of entites) {
                    result.push({
                        model: schema[f].relation,
                        pk: e[f],
                    })
                }
            }
        }
        state.reactive_delete_list = result
    },
}
