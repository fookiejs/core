import { lifecycle } from "../.."

export default async function (payload, state) {
    for (const type of payload.body.types) {
        if (!ctx.local.has("type", type)) {
            return false
        }
    }
    return true
}
