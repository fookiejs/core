import * as lodash from "lodash"

export default async function (payload, state) {
    const model = payload.model
    const filtered_schema = lodash.pick(model.schema, lodash.keys(payload.body))
    const writes = lodash.map(filtered_schema, function (i) {
        return i["write"]
    })
    const filtered_writes = lodash.difference(writes, [undefined, null])
    const roles = lodash.flatten(filtered_writes)

    for (let role of roles) {
        const res = await ctx.local.get("lifecycle", role).function(payload, state)
        if (!res) {
            return false
        }
    }

    return true
}
