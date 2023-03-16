import { lifecycle } from "../.."

export default async function (payload, state) {
    let body_keys = ctx.lodash.keys(payload.body)
    let schema_keys = ctx.lodash.keys(ctx.local.get("model", payload.model).schema)
    for (const key of body_keys) {
        if (!schema_keys.includes(key)) {
            //console.log("WKEY:" + key)
            return false
        }
    }
    return true
}
