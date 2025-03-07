import * as lodash from "lodash"
import { Modify } from "../../lifecycle-function"
import { FookieError } from "../../error"

export default Modify.new({
    key: "filter_fields",
    execute: async function (payload) {
        const error = FookieError.new({
            validationErrors: {},
            key: "filter_fields",
        })

        for (const key of payload.query.attributes) {
            const field = payload.model.schema()[key]

            let show = true

            for (const role of field.read || []) {
                const res = await role.execute(payload, error)

                show = show && !!res
            }

            if (!show) {
                payload.query.attributes = lodash.pull(payload.query.attributes, key)
            }
        }
    },
})
