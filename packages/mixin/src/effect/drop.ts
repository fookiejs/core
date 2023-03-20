import * as lodash from "lodash"
import { run } from "@fookie/core"
import { Delete } from "@fookie/method"
import { LifecycleFunction } from "@fookie/core"

const drop: LifecycleFunction = async function (payload, state) {
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
