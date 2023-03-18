import * as lodash from "lodash"
import { models, run } from "../.."
import { Delete } from "../../methods"

const cascade_prepare: LifecycleFunction = async function (payload, state) {
    for (let model of models) {
        for (let field in model.schema) {
            if (
                model.schema[field].cascade_delete &&
                model.schema[field].relation &&
                model.schema[field].relation === payload.model
            ) {
                let res = await run({
                    token: process.env.SYSTEM_TOKEN,
                    model: payload.model,
                    method: "read",
                    query: payload.query,
                })
                state.cascade_delete_ids = res.data.map(function (e) {
                    return e[payload.model.database.pk]
                })
            }
        }
    }
}

export default cascade_prepare
