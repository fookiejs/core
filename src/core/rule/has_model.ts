import { lifecycle } from "../.."

export default async function (payload, state) {
    if (ctx.lodash.has(payload, "model") && typeof payload.model == "string") {
        if (ctx.local.has("model", payload.model)) {
            return true
        }
    }
    return false
}
