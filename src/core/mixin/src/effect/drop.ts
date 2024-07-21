import { LifecycleFunction } from "../../../lifecycle-function"
import * as lodash from "lodash"

export default LifecycleFunction.new({
    key: "drop",
    execute: async function (payload) {
        if (lodash.has(payload.options, "drop")) {
            if (payload.options.drop! > 0) {
                setTimeout(async function () {
                    await payload.modelClass.delete(
                        {
                            filter: {
                                // @ts-expect-error: TODO
                                id: { equals: payload.response.id },
                            },
                        },
                        {
                            token: payload.options.token,
                        },
                    )
                }, payload.options.drop)
            } else {
                await payload.modelClass.delete(
                    {
                        filter: {
                            // @ts-expect-error: Explain why this line is expected to have an error
                            id: { equals: payload.response.id },
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
