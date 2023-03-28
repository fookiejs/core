import { models, run } from "../../../core"
import { LifecycleFunction } from "../../../../types"
import { Delete, Read } from "../../../method"

const cascade_prepare: LifecycleFunction = async function (payload, state) {
    const res = await run({
        token: process.env.SYSTEM_TOKEN,
        model: payload.model,
        method: Read,
        query: payload.query,
    })

    const cascade_delete_ids = res.data.map(function (e) {
        return e[payload.model.database.pk]
    })

    for (const model of models) {
        for (const field in model.schema) {
            if (
                model.schema[field].cascade_delete &&
                model.schema[field].relation &&
                model.schema[field].relation === payload.model
            ) {
                state.todo.push({
                    token: process.env.SYSTEM_TOKEN,
                    model: model,
                    method: Delete,
                    query: {
                        filter: {
                            [field]: {
                                or: cascade_delete_ids,
                            },
                        },
                    },
                })
            }
        }
    }
}

export default cascade_prepare
