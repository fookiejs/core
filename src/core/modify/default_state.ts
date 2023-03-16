module.exports = {
    name: "default_state",
    wait: true,
    function: async function (payload, ctx, state) {
        state.model = ctx.local.get("model", payload.model)
        state.database = ctx.local.get("database", state.model.database)
    },
}
