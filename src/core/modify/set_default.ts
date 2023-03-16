import * as lodash from "lodash"

export default async function (payload, state) {
    let model = payload.model
    let defaults = lodash.mapValues(model.schema, function (o) {
        return o.default
    })
    defaults = lodash.pickBy(defaults, function (v) {
        return !lodash.isUndefined(v)
    })
    payload.body = lodash.defaults(payload.body, defaults)
}
