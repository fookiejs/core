import * as lodash from "lodash"
import { run } from "../../../run"
import { Read, Update } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const reactives: LifecycleFunction<unknown, "create" | "read" | "delete"> = async function (payload) {
    const schema = payload.model.schema
    const fields = lodash.keys(schema)

    for (const field of fields) {
        if (lodash.has(schema[field], "reactives")) {
            for (const reactive of schema[field].reactives) {
                const entities = await run<any, "read">({
                    token: process.env.SYSTEM_TOKEN,
                    model: payload.model,
                    method: Read,
                    query: payload.query,
                })
                for (const entity of entities.data) {
                    if (entity[field]) {
                        await run({
                            token: process.env.SYSTEM_TOKEN,
                            model: schema[field].relation,
                            method: Update,
                            query: {
                                filter: {
                                    pk: { equals: entity[field] },
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

export default reactives
