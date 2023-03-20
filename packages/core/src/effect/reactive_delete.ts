import * as lodash from "lodash"
import { run } from "@fookie/core"
import { Delete } from "@fookie/method"
const reactive_delete: LifecycleFunction = async function (payload, state) {
    for (const { model, pk } of state.reactive_delete_list) {
        await run({
            token: process.env.SYSTEM_TOKEN,
            model: model,
            method: Delete,
            query: {
                filter: {
                    pk: pk,
                },
            },
        })
    }
}

export default reactive_delete
