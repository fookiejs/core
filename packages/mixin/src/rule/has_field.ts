import * as lodash from "lodash"
import { models, run } from "@fookie/core"
import { Count, Delete, Read, Update } from "@fookie/method"
import { LifecycleFunction } from "@fookie/core"

const has_field: LifecycleFunction = async function (payload, state) {
    let body_keys = lodash.keys(payload.body)
    let schema_keys = lodash.keys(payload.model.schema)
    for (const key of body_keys) {
        if (!schema_keys.includes(key)) {
            return false
        }
    }
    return true
}

export default has_field
