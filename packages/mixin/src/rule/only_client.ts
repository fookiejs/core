import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const only_client: LifecycleFunction<unknown, any> = async function (payload) {
    const search = ["", null, undefined]
    const model = payload.model
    const keys = lodash.keys(model.schema)
    for (const key of keys) {
        if (model.schema[key].only_client == true) {
            if (search.includes(payload.body[key])) {
                return false
            }
        }
    }
    return true
}

export default only_client
