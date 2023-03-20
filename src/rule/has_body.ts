import * as lodash from "lodash"
import { v4 } from "uuid"
import { models, run } from "../.."
import { Delete } from "../../packages/methods"

const has_body: LifecycleFunction = async function (payload, state) {
    return lodash.has(payload, "body")
}

export default has_body
