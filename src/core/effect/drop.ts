import * as lodash from "lodash"
import { run } from "../.."
import { Delete } from "../../methods"

const drop = async function (payload, state) {
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
