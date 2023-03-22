import * as lodash from "lodash"
import { models, run } from "../../../core"
import { Read, Delete, Create, Count } from "../../../method"
import { LifecycleFunction } from "../../../../types"

const has_body: LifecycleFunction = async function (payload, state) {
    return lodash.has(payload, "body")
}

export default has_body
