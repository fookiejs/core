import * as lodash from "lodash"
import { run } from "../../..//core"
import { Delete } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const drop: LifecycleFunction = async function (payload) {
    if (lodash.has(payload.options, "drop")) {
        setTimeout(async function () {
            await run({
                token: payload.token,
                model: payload.model,
                method: Delete,
                query: {
                    filter: {
                        pk: payload.response.data[payload.model.database.pk],
                    },
                },
            })
        }, payload.options.drop)
    }
}

export default drop
