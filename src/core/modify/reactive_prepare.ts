import * as lodash from "lodash"

export default async function (payload, state) {
    let result = []
    const entites = await ctx.remote.all(payload.model, payload.query)
    const schema = payload.model.schema
    const has = lodash.has
    for (const f in schema) {
        if (has(schema[f], "reactive_delete") && !!schema[f].reactive_delete) {
            for (const e of entites) {
                result.push({
                    model: schema[f].relation,
                    pk: e[f],
                })
            }
        }
    }
    state.reactive_delete_list = result
}
