import { lifecycle } from "../.."

export default async function (payload, state) {
    const model = ctx.local.get("model", payload.model)
    const filtered_schema = ctx.lodash.pick(model.schema, ctx.lodash.keys(payload.body))
    const writes = ctx.lodash.map(filtered_schema, function (i) {
        return i["write"]
    })
    const filtered_writes = ctx.lodash.difference(writes, [undefined, null])
    const roles = ctx.lodash.flatten(filtered_writes)

    for (let role of roles) {
        const res = await ctx.local.get("lifecycle", role).function(payload, state)
        if (!res) {
            return false
        }
    }

    return true
}
