module.exports = {
    name: "db_connect",
    wait: true,
    function: async function (payload, ctx, state) {
        let model = ctx.local.get("model", payload.model)
        let db = ctx.local.get("database", model.database)
        return await db.connect()
    },
}
