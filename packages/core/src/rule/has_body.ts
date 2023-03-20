import * as lodash from "lodash"
import { models, run } from "@fookie/core"
import { Delete } from "@fookie/method"

const has_body: LifecycleFunction = async function (payload, state) {
    return lodash.has(payload, "body")
}

export default has_body
