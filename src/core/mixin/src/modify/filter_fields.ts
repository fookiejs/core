import * as lodash from "lodash"
import { Modify } from "../../../lifecycle-function"
import { Field } from "../../../field/field"

export default Modify.new({
    key: "filter_fields",
    execute: async function (payload) {
        for (const key of payload.query.attributes) {
            const field = payload.schema[key as keyof typeof payload.schema] as Field

            let show = true

            for (const role of field.read || []) {
                const res = await role.execute(payload)

                show = show && !!res
            }

            if (!show) {
                payload.query.attributes = lodash.pull(payload.query.attributes, key)
            }
        }
    },
})
