import * as lodash from "lodash"

const check_type: LifecycleFunction = async function (payload, state) {
    for (const field of lodash.keys(payload.body)) {
        const type = payload.model.schema[field].type

        if (!type(payload.body[field])) {
            console.log(payload.body[field])
            return false
        }
    }
    return true
}

export default check_type
