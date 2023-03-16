import * as lodash from "lodash"

export default async function (payload, state) {
    const model = payload.model
    let fields = lodash.keys(payload.body)
    let res = true
    for (let f of fields) {
        const field = model.schema[f]
        const value = payload.body[f]
        if (lodash.isNumber(field.min)) {
            res = res && value >= field.min
        }

        if (lodash.isNumber(field.max)) {
            res = res && value <= field.max
        }

        if (lodash.isNumber(field.maxSize)) {
            res = res && value.length <= field.maxSize
        }

        if (lodash.isNumber(field.minSize)) {
            res = res && value.length >= field.minSize
        }
    }
    return res
}
