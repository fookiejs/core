import { lifecycle } from "../.."

export default async function (payload, state) {
    const schema = state.model.schema
    const fields = ctx.lodash.keys(schema)

    for (const field of fields) {
        if (ctx.lodash.has(schema[field], "reactives")) {
            for (const reactive of schema[field].reactives) {
                const entities = await ctx.remote.all(payload.model, payload.query)
                for (const entity of entities) {
                    if (entity[field]) {
                        await ctx.run({
                            model: schema[field].relation,
                            method: "update",
                            query: {
                                filter: {
                                    pk: entity[field],
                                },
                            },
                            body: {
                                [reactive.to]: reactive.compute(payload.body[reactive.from]),
                            },
                        })
                    }
                }
            }
        }
    }
}
