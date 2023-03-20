import * as lodash from "lodash"

const only_client: LifecycleFunction = async function (payload, ctx) {
    let search = ["", null, undefined]
    let model = payload.model
    let keys = lodash.keys(model.schema)
    for (let key of keys) {
        if (model.schema[key].only_client == true) {
            if (search.includes(payload.body[key])) {
                return false
            }
        }
    }
    return true
}

export default only_client
