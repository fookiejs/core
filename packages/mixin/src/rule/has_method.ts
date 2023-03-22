import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const has_method: LifecycleFunction = async function (payload, state) {
    return lodash.has(payload.model.methods, payload.method)
}

export default has_method
