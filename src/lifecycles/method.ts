module.exports = async function (payload, state) {
    let start = Date.now()

    if (ctx.lodash.isUndefined(payload.response.data)) {
        await ctx.local.get("model", payload.model).methods[payload.method](payload, state)
    }
    state.metrics.lifecycle.push({
        name: "method",
        time: Date.now() - start,
    })
}
