import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const only_server: LifecycleFunction = async function (payload) {
    const keys = lodash.keys(payload.model.schema)
    for (const key of keys) {
        if (payload.model.schema[key].only_server == true) {
            if (payload.body[key]) {
                return false
            }
        }
    }
    return true
}

export default only_server
