import { lifecycle } from "../.."

export default async function (payload, state) {
    return ctx.local.has("database", payload.body.database)
}
