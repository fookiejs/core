module.exports = {
    name: "need_method_in_options",
    wait: true,
    function: async function (payload, ctx) {
        return (
            ctx.lodash.has(payload.options, "method") &&
            typeof payload.options.method == "string"
        )
    },
}
