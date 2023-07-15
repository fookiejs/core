import * as lodash from "lodash"
import { run } from "../../../core"
import { Read, Delete } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const reactive_prepare: LifecycleFunction = async function (payload, state) {
    const result = []

    const entities = await run({
        token: process.env.SYSTEM_TOKEN,
        model: payload.model,
        method: Read,
        query: payload.query,
    })

    const schema = payload.model.schema
    const has = lodash.has
    for (const field in schema) {
        if (has(schema[field], "reactive_delete") && !!schema[field].reactive_delete) {
            for (const entity of entities.data) {
                state.todo.push({
                    token: process.env.SYSTEM_TOKEN,
                    model: schema[field].relation,
                    method: Delete,
                    query: {
                        filter: {
                            pk: entity[field],
                        },
                    },
                })
            }
        }
    }
}

export default reactive_prepare
