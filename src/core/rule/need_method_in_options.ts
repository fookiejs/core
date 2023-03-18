import * as lodash from "lodash"
import { v4 } from "uuid"
import { models, run } from "../.."
import { Count, Delete, Read, Update } from "../../methods"

const need_method_in_options: LifecycleFunction = async function (payload, ctx) {
    return lodash.has(payload.options, "method") && typeof payload.options.method == "string"
}

export default need_method_in_options
