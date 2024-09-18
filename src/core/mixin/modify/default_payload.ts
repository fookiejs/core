import * as lodash from "lodash"
import { v4 } from "uuid"
import { Rule } from "../../lifecycle-function"

export default Rule.new({
    key: "defalut_payload",
    execute: async function (payload) {
        const newPayload = lodash.merge(payload, {
            options: {},
            body: {},
            query: {
                attributes: [],
            },
            id: v4().replace("-", ""),
        })

        if (!lodash.has(newPayload.query, "filter")) {
            newPayload.query.filter = {}
        }

        for (const key in newPayload) {
            payload[key] = newPayload[key]
        }

        if (!lodash.has(payload.query, "offset")) {
            payload.query.offset = 0
        }
        if (!lodash.has(payload.query, "limit")) {
            payload.query.limit = Infinity
        }

        if (payload.query.attributes.length == 0) {
            payload.query.attributes = lodash.keys(payload.modelClass.schema())
        }
        return true
    },
})
