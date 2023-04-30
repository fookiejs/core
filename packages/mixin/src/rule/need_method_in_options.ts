import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"
import { Methods } from "../../../method"

const need_method_in_options: LifecycleFunction = async function (payload) {
    return (
        lodash.has(payload.options, "method") &&
        typeof payload.options.method == "string" &&
        Methods.includes(payload.options.method)
    )
}

export default need_method_in_options
