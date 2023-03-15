module.exports = {
    name: "has_model",
    wait: true,
    function: async function (payload, ctx, state) {
        if (
            ctx.lodash.has(payload, "model") &&
            typeof payload.model == "string"
        ) {
            if (ctx.local.has("model", payload.model)) {
                return true
            }
        }
        return false
    },
}
