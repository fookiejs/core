import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const has_body: LifecycleFunction<unknown, any> = async function (payload) {
    return lodash.has(payload, "body")
}

export default has_body
