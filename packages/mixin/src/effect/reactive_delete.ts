import { run } from "../../..//core"
import { Delete } from "../../../method"
import { LifecycleFunction } from "../../../../types"

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
        }) // TODO
    }
}

export default reactive_delete
