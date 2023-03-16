module.exports = {
    name: "database_modify",
    wait: true,
    function: async function (payload, ctx, state) {
        if (ctx.lodash.has(payload.body, "database")) {
            // updated for update method.
            payload.body.methods = {}
            await ctx.local.get("database", payload.body.database).modify(payload.body, ctx, state)

            payload.body.methods.test = async function (_payload, _ctx, _state) {
                let p = Object.assign(ctx.lodash.omit(_payload, ["response"]))
                p.method = _payload.options.method
                let s = {
                    metrics: {
                        start: Date.now(),
                        lifecycle: [],
                    }
                }
                p.response =  {
                    data: undefined,
                    status: false,
                    error: null
                }

                if (await ctx.helpers.preRule(p, ctx, s)) {
                    await ctx.helpers.modify(p, ctx, s)
                    if (await _ctx.helpers.role(p, ctx, s)) {
                        if (await _ctx.helpers.rule(p, ctx, s)) {
                            p.response.status = true
                        }
                    }
                }
                _payload.response.data = Object.assign(p.response)
            }
        }
    },
}
