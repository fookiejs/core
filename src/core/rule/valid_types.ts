module.exports = {
    name: "valid_types",
    wait: true,
    function: async function (payload, ctx, state) {
        for (const type of payload.body.types) {
            if (!ctx.local.has("type", type)) {
                return false
            }
        }
        return true
    },
}
