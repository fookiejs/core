import { lifecycle } from "../.."

export default async function (payload, state) {
    state.model = ctx.local.get("model", payload.model)
    state.database = ctx.local.get("database", state.model.database)
}
