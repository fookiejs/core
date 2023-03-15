module.exports = {
    name: "fix_schema",
    wait: true,
    function: async function (payload, ctx, state) {
        function uniqMerge(target, source) {
            return ctx.lodash.uniq([...target, ...source])
        }
        let options = {
            arrayMerge: uniqMerge,
        }

        let methods = ["create", "read", "update", "delete", "count", "test"]
        methods = methods.concat(ctx.lodash.keys(payload.body.lifecycle))
        methods = methods.concat(ctx.lodash.keys(payload.body.methods))
        methods = ctx.lodash.uniq(methods)

        for (let f of ctx.lodash.keys(payload.body.schema)) {
            payload.body.schema[f] = ctx.helpers.deepMerge(
                payload.body.schema[f],
                {
                    write: [],
                    read: [],
                },
                options
            )
        }

        for (let method of methods) {
            payload.body.lifecycle[method] = ctx.helpers.deepMerge(
                payload.body.lifecycle[method],
                {
                    modify: [],
                    effect: [],
                    rule: [],
                    preRule: [],
                    role: [],
                    filter: [],
                },
                options
            )
        }
        payload.body.mixins = ctx.lodash.uniq(
            ctx.helpers.deepMerge(payload.body.mixin, ["after", "before"], options)
        )
    },
}
