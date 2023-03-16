import * as lodash from "lodash"

export default async function (payload, state) {
    let keys = lodash.keys(payload.model.schema)
    keys = keys.filter(function (k) {
        return payload.model.schema[k].default
    })
    keys.forEach(async function (k) {
        const modify = await ctx.run({
            token: "system_token",
            model: "lifecycle",
            method: "read",
            query: {
                filter: {
                    name: payload.model.schema[k].default,
                },
            },
        })
        if (payload.body[k] == undefined) {
            payload.body[k] = modify[0](payload, state)
        }
    })
}
