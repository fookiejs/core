import * as lodash from "lodash"
import { Modify } from "../../lifecycle-function"
import { models } from "../../model/model"
import { Config } from "../../config"

export default Modify.new({
    key: "cascade_prepare",
    execute: async function (payload) {
        const entities = await payload.modelClass.read(payload.query, {
            token: Config.SYSTEM_TOKEN
        })
        const cascade_delete_ids = entities.map(function (e) {
            return e.id
        })

        for (const model of models) {
            const schema = model.schema()
            for (const field in schema) {
                if (
                    schema[field].cascadeDelete &&
                    schema[field].relation &&
                    lodash.isEqual(schema[field].relation["name"], payload.modelClass["name"])
                ) {
                    const fn = async function () {
                        await model.delete(
                            {
                                filter: {
                                    [field]: { in: cascade_delete_ids },
                                },
                            },
                            {
                                token: Config.SYSTEM_TOKEN
                            },
                        )
                    }

                    payload.state.todo.push(fn)
                }
            }
        }
    },
})
