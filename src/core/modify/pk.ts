module.exports = {
    name: "pk",
    wait: true,
    function: async function (payload, ctx, state) {
        let model = ctx.local.get("model", payload.model)
        let database = ctx.local.get("database", model.database)
        if (ctx.lodash.has(payload.query.filter, "pk")) {
            payload.query.filter = ctx.lodash.assign(payload.query.filter, {
                [database.pk]: payload.query.filter.pk,
            })
            payload.query.filter = ctx.lodash.omit(payload.query.filter, ["pk"])
        }
    },
}
