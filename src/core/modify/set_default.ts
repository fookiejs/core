module.exports = {
    name: "set_default",
    wait: true,
    function: async function (payload, ctx, state) {
        let model = ctx.local.get("model", payload.model)
        let defaults = ctx.lodash.mapValues(model.schema, function (o) { return o.default })
        defaults = ctx.lodash.pickBy(defaults, function (v) { return !ctx.lodash.isUndefined(v) })
        payload.body = ctx.lodash.defaults(payload.body, defaults)
    },
}
