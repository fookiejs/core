module.exports = {
    name: "check_type",
    wait: true,
    function: async function (payload, ctx, state) {
        for (const field of ctx.lodash.keys(payload.body)) {
            const type = ctx.local.get("type", state.model.schema[field].type)
            if (payload.body[field] && !type.controller(payload.body[field])) {
                return false
            }
        }
        return true
    },
}
