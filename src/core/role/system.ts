module.exports = {
    name: "system",
    wait: true,
    function: async function (payload, ctx, state) {
        return ctx.lodash.isString(process.env.SYSTEM_TOKEN) && process.env.SYSTEM_TOKEN === payload.token
    },
}
