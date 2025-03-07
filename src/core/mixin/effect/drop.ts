import { Effect } from "../../lifecycle-function"
import * as lodash from "lodash"

export default Effect.new({
    key: "drop",
    execute: async function (payload, response) {
        if (lodash.has(payload.options, "drop")) {
            if (payload.options.drop! > 0) {
                setTimeout(async function () {
                    await payload.model.delete(
                        {
                            filter: {
                                id: { equals: response.id },
                            },
                        },
                        {
                            token: payload.options.token,
                        },
                    )
                }, payload.options.drop)
            } else {
                await payload.model.delete(
                    {
                        filter: {
                            id: { equals: response.id },
                        },
                    },
                    {
                        token: payload.options.token,
                    },
                )
            }
        }
    },
})
