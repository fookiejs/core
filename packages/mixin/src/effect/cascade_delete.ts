import { models, run } from "../../..//core"
import { Delete } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const cascade_delete: LifecycleFunction = async function (payload, state) {
    for (let model of models) {
        for (let field in model.schema) {
            if (
                model.schema[field].cascade_delete &&
                model.schema[field].relation &&
                model.schema[field].relation === payload.model
            ) {
                for (let id of state.cascade_delete_ids) {
                    await run({
                        token: process.env.SYSTEM_TOKEN,
                        model: model,
                        method: Delete,
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

export default cascade_delete
