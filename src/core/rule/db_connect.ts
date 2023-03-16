import { lifecycle } from "../.."

export default async function (payload, state) {
    let model = ctx.local.get("model", payload.model)
    let db = ctx.local.get("database", model.database)
    return await db.connect()
}
