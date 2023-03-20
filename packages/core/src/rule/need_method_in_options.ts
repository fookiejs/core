import * as lodash from "lodash"
import { models, run } from "@fookie/core"
import { Count, Delete, Read, Update } from "@fookie/method"

const need_method_in_options: LifecycleFunction = async function (payload, ctx) {
    return lodash.has(payload.options, "method") && typeof payload.options.method == "string"
}

export default need_method_in_options
