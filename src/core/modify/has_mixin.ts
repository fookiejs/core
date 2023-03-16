module.exports = {
    name: "has_mixin",
    wait: true,
    function: async function (payload, ctx, state) {
        if (payload.body.mixins) {
            for (const i of payload.body.mixins) {
                if (!ctx.local.has("mixin", i)) {
                    return false
                }
            }
        }
    },
}
