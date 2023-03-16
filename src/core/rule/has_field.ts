import * as lodash from "lodash"

export default async function (payload, state) {
    let body_keys = lodash.keys(payload.body)
    let schema_keys = lodash.keys(payload.model.schema)
    for (const key of body_keys) {
        if (!schema_keys.includes(key)) {
            //console.log("WKEY:" + key)
            return false
        }
    }
    return true
}
