module.exports = {
    name: "has_body",
    wait: true,
    function: function (payload, ctx, state) {
        return ctx.lodash.has(payload, "body")
    },
}
