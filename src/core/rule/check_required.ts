import * as lodash from "lodash"

const check_required: LifecycleFunction = async function (payload, state) {
    let search = [null, undefined]
    let keys = payload.method == "create" ? lodash.keys(payload.model.schema) : lodash.keys(payload.body)
    for (let key of keys) {
        if (payload.model.schema[key].required == true) {
            if (search.includes(payload.body[key])) {
                return false
            }
        }
    }
    return true
}

export default check_required
