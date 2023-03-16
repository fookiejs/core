import { lifecycle } from "../.."

export default async function (payload, state) {
    let allModels = ctx.local.all("model", payload.model)
    for (let model of allModels) {
        for (let field in model.schema) {
            if (
                model.schema[field].cascadeDelete &&
                model.schema[field].relation &&
                model.schema[field].relation === payload.model
            ) {
                for (let id of state.cascadeDeleteIds) {
                    await ctx.run({
                        model: model.name,
                        method: "delete",
                        query: {
                            filter: {
                                [field]: id,
                            },
                        },
                    })
                }
            }
        }
    }
}
