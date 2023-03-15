module.exports = {
    name: "selection",
    wait: true,
    function: async function (payload, ctx, state) {
        let model = ctx.local.get("model", payload.model)
        let fields = ctx.lodash.keys(model.schema)
        for (let field of fields) {
            if (
                typeof model.schema[field].selection === "string" &&
                !payload.body[field]
            ) {
                let selection = ctx.local.get(
                    "selection",
                    model.schema[field].selection
                )
                let res = await selection.function(model.schema[field].relation, ctx
                )
                if (res) {
                    payload.body[field] = res[state.database.pk]
                }
            }
        }
    },
}
