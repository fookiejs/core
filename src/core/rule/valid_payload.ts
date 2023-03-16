module.exports = {
    name: "valid_payload",
    wait: true,
    function: async function (payload, ctx, state) {
        if (ctx.lodash.has(payload, "method") && !ctx.lodash.isString(payload.method))
            return false
        if (ctx.lodash.has(payload, "model") && !ctx.lodash.isString(payload.model))
            return false
        if (ctx.lodash.has(payload, "options") && !ctx.lodash.isObject(payload.options))
            return false
        if (ctx.lodash.has(payload, "token") && !ctx.lodash.isString(payload.token))
            return false
        if (ctx.lodash.has(payload, "body") && !ctx.lodash.isObject(payload.body))
            return false
        if (ctx.lodash.has(payload, "query") && !ctx.lodash.isObject(payload.query))
            return false
        if (ctx.lodash.has(payload.options, "drop") && !ctx.lodash.isNumber(payload.options.drop))
            return false
        if (ctx.lodash.has(payload.options, "method") && !ctx.lodash.isString(payload.options.method))
            return false
        if (ctx.lodash.has(payload.options, "simplified") && !ctx.lodash.isBoolean(payload.options.simplified))
            return false

        let avaible_keys = [
            "response",
            "method",
            "model",
            "options",
            "token",
            "body",
            "query",
            "id",
        ]
        return ctx.lodash.without(ctx.lodash.keys(payload), ...avaible_keys).length === 0
    },
}
