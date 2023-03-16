module.exports = {
    name: "valid_attributes",
    wait: true,
    function: async function (payload, ctx, state) {
        const model = ctx.local.get("model", payload.model)
        return payload.query.attributes.every(function (k) {
            return ctx.lodash.keys(model.schema).includes(k)
        })
    }
}
