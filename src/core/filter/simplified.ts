module.exports = {
    name: "simplified",
    wait: true,
    function: async function (payload, ctx, state) {
        if (ctx.lodash.has(payload.options, "simplified")) {
            const keys = [
                state.database.pk,
                ...ctx.lodash.keys(state.model.schema),
            ]
            for (let i in payload.response.data) {
                payload.response.data[i] = ctx.lodash.mapKeys(
                    payload.response.data[i],
                    function (v, k) {
                        return ctx.lodash.indexOf(keys, k)
                    }
                )
            }
        }
    },
}
