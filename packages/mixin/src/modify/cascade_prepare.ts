import { models, run } from "../../../core"
import { LifecycleFunction } from "../../../../types"

const cascade_prepare: LifecycleFunction = async function (payload, state) {
    for (const model of models) {
        for (const field in model.schema) {
            if (
                model.schema[field].cascade_delete &&
                model.schema[field].relation &&
                model.schema[field].relation === payload.model
            ) {
                const res = await run({
                    token: process.env.SYSTEM_TOKEN,
                    model: payload.model,
                    method: "read",
                    query: payload.query,
                })
                state.cascade_delete_ids = res.data.map(function (e) {
                    //TODO
                    return e[payload.model.database.pk]
                })
            }
        }
    }
}

export default cascade_prepare
