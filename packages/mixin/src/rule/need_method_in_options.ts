import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const need_method_in_options: LifecycleFunction = async function (payload) {
    return lodash.has(payload.options, "method") && typeof payload.options.method == "string"
}

export default need_method_in_options
