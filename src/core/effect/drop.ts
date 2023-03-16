module.exports = {
    name: "drop",
    wait: true,
    function: async function (payload, ctx, state) {
        if (ctx.lodash.has(payload.options, "drop")) {
            setTimeout(async function () {
                await ctx.run({
                    model: payload.model,
                    method: "delete",
                    token: payload.token,
                    query: {
                        filter: {
                            pk: payload.response.data[state.database.pk],
                        },
                    },
                })
            }, payload.options.drop)
        }
    },
}
