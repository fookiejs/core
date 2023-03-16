import * as lodash from "lodash"

export default async function (payload, state) {
    for (const field of lodash.keys(payload.body)) {
        const type = payload.model.schema[field].type
        if (payload.body[field] && !type(payload.body[field])) {
            return false
        }
    }
    return true
}
