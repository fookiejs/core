import * as lodash from "lodash"

const check_required: LifecycleFunction = async function (payload, state) {
    let search = [null, undefined]
    let model = payload.model
    let keys = payload.method == "create" ? lodash.keys(model.schema) : lodash.keys(model.body)
    for (let key of keys) {
        if (model.schema[key].required == true) {
            if (search.includes(payload.body[key])) {
                return false
            }
        }
    }
    return true
}

export default check_required
