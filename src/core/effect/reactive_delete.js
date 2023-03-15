module.exports = {
    name: "reactive_delete",
    wait: true,
    function: async function (payload, ctx, state) {
        for (const { model, pk } of state.reactive_delete_list) {
            await ctx.remote.delete(model, pk)
        }
    },
}
