import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const check_required: LifecycleFunction = async function (payload) {
    const search = [null, undefined]
    const keys = payload.method == "create" ? lodash.keys(payload.model.schema) : lodash.keys(payload.body)
    for (const key of keys) {
        if (payload.model.schema[key].required == true) {
            if (search.includes(payload.body[key])) {
                return false
            }
        }
    }
    return true
}

export default check_required
