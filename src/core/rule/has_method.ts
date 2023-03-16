import { lifecycle } from "../.."

export default async function (payload, state) {
    if (ctx.lodash.has(payload, "method") && typeof payload.method == "string") {
        let model = ctx.local.get("model", payload.model)
        if (ctx.lodash.has(model.methods, payload.method)) {
            return true
        }
    }
    return false
}
