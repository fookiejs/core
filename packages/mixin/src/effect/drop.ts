import * as lodash from "lodash"
import { run } from "../../../run"
import { Delete } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const drop: LifecycleFunction<unknown, any> = async function (payload) {
    if (lodash.has(payload.options, "drop")) {
        setTimeout(async function () {
            await run({
                token: payload.token,
                model: payload.model,
                method: Delete,
                query: {
                    filter: {
                        pk: { equals: payload.response.data[payload.model.database.pk] },
                    },
                },
            })
        }, payload.options.drop)
    }
}

export default drop
