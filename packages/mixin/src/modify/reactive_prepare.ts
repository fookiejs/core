import * as lodash from "lodash"
import { run } from "../../../core"
import { Read } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const reactive_prepare: LifecycleFunction = async function (payload, state) {
    const result = []

    const entities = await run({
        model: payload.model,
        method: Read,
        query: payload.query,
    })

    const schema = payload.model.schema
    const has = lodash.has
    for (const f in schema) {
        if (has(schema[f], "reactive_delete") && !!schema[f].reactive_delete) {
            for (const e of entities.data) {
                result.push({
                    model: schema[f].relation,
                    pk: e[f],
                })
            }
        }
    }

    state.reactive_delete_list = result
}

export default reactive_prepare
