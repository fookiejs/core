import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const selection: LifecycleFunction = async function (payload) {
    const fields = lodash.keys(payload.model.schema)
    for (const field of fields) {
        if (typeof payload.model.schema[field].selection === "function" && !payload.body[field]) {
            payload.body[field] = await payload.model.schema[field].selection(payload, payload.model.schema[field].relation)
        }
    }
}

export default selection
