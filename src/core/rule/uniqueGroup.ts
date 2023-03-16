module.exports = {
    name: "uniqueGroup",
    wait: true,
    function: async function (payload, ctx) {
        let model = ctx.local.get("model", payload.model)
        let fields = ctx.lodash.keys(payload.body)
        let groups = []
        for (let field of fields) {
            if (model.schema[field].uniqueGroup) {
                groups = ctx.lodash.uniq(
                    groups.concat(model.schema[field].uniqueGroup)
                )
            }
        }

        for (const group of groups) {
            let filter = {}
            for (const field of ctx.lodash.keys(model.schema)) {
                if (
                    model.schema[field].uniqueGroup &&
                    model.schema[field].uniqueGroup.includes(group) &&
                    payload.body[field]
                ) {
                    filter[field] = payload.body[field]
                }
            }

            const res = await ctx.run({
                token: process.env.SYSTEM_TOKEN,
                model: model.name,
                method: "count",
                query: {
                    filter,
                },
            })
            return res.data == 0
        }

        return true
    },
}
