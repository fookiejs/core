import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const check_type: LifecycleFunction = async function (payload) {
    for (const field of lodash.keys(payload.body)) {
        const type = payload.model.schema[field].type

        if (!type(payload.body[field])) {
            return false
        }
    }
    return true
}

export default check_type
