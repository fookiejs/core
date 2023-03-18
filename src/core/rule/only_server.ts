import * as lodash from "lodash"
import { v4 } from "uuid"
import { models, run } from "../.."
import { Count, Delete, Read, Update } from "../../methods"

const only_server: LifecycleFunction = async function (payload, ctx) {
    let model = payload.model
    let keys = lodash.keys(model.schema)
    for (let key of keys) {
        if (model.schema[key].only_server == true) {
            if (payload.body[key]) {
                return false
            }
        }
    }
    return true
}

export default only_server
