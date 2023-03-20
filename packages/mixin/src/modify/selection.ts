import * as lodash from "lodash"
import { LifecycleFunction } from "@fookie/core"

const selection: LifecycleFunction = async function (payload, state) {
    let model = payload.model
    let fields = lodash.keys(model.schema)
    for (let field of fields) {
        if (typeof model.schema[field].selection === "function" && !payload.body[field]) {
            payload.body[field] = await model.schema[field].selection(model, model.schema[field])
        }
    }
}

export default selection
