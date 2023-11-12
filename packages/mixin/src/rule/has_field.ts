import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const has_field: LifecycleFunction<unknown, any> = async function (payload) {
    const body_keys = lodash.keys(payload.body)
    const schema_keys = lodash.keys(payload.model.schema)
    for (const key of body_keys) {
        if (!schema_keys.includes(key)) {
            return false
        }
    }
    return true
}

export default has_field
