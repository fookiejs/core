import * as lodash from "lodash"

export default async function (payload, ctx) {
    let search = ["", null, undefined]
    let model = payload.model
    let keys = lodash.keys(model.schema)
    for (let key of keys) {
        if (model.schema[key].onlyServer == true) {
            if (payload.body[key]) {
                return false
            }
        }
    }
    return true
}
