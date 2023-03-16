import * as lodash from "lodash"

export default async function (payload, state) {
    payload.model = payload.model
    payload.model.database = ctx.local.get("database", payload.model.database)
}
