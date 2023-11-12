import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"
import { log } from "util"

const check_type: LifecycleFunction<any, any> = async function (payload) {
    for (const field of lodash.keys(payload.body)) {
        const type = payload.model.schema[field].type

        if (!type.controller(payload.body[field])) {
            return false
        }
    }
    return true
}

export default check_type
