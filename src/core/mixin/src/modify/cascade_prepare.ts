import * as lodash from "lodash"
import { LifecycleFunction } from "../../../lifecycle-function"
import { models } from "../../../model/model"
import { Config } from "../../../config"

export default LifecycleFunction.new({
    key: "cascade_prepare",
    execute: async function (payload) {
        const entities = await payload.modelClass.read(payload.query, {
            token: Config.get("SYSTEM_TOKEN"),
        })
        const cascade_delete_ids = entities.map(function (e) {
            return e.id
        })

        for (const model of models) {
            for (const field in model.schema) {
                if (
                    model.schema[field].cascadeDelete &&
                    model.schema[field].relation &&
                    lodash.isEqual(model.schema[field].relation["name"], payload.modelClass["name"])
                ) {
                    const fn = async function () {
                        await model.modelClass.delete(
                            {
                                filter: {
                                    [field]: { in: cascade_delete_ids },
                                },
                            },
                            {
                                token: Config.get("SYSTEM_TOKEN"),
                            },
                        )
                    }

                    payload.state.todo.push(fn)
                }
            }
        }
    },
})
