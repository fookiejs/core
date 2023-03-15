module.exports = {
    name: "has_database",
    wait: true,
    function: async function (payload, ctx, state) {
        return ctx.local.has("database", payload.body.database)
    },
}
