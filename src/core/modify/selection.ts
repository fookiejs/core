import * as lodash from "lodash"

export default async function (payload, state) {
    let model = payload.model
    let fields = lodash.keys(model.schema)
    for (let field of fields) {
        if (typeof model.schema[field].selection === "string" && !payload.body[field]) {
            let selection = ctx.local.get("selection", model.schema[field].selection)
            let res = await selection.function(model.schema[field].relation, ctx)
            if (res) {
                payload.body[field] = res[payload.model.database.pk]
            }
        }
    }
}
