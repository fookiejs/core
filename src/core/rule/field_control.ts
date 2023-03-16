import { lifecycle } from "../.."

export default async function (payload, state) {
    const model = ctx.local.get("model", payload.model)
    let fields = ctx.lodash.keys(payload.body)
    let res = true
    for (let f of fields) {
        const field = model.schema[f]
        const value = payload.body[f]
        if (ctx.lodash.isNumber(field.min)) {
            res = res && value >= field.min
        }

        if (ctx.lodash.isNumber(field.max)) {
            res = res && value <= field.max
        }

        if (ctx.lodash.isNumber(field.maxSize)) {
            res = res && value.length <= field.maxSize
        }

        if (ctx.lodash.isNumber(field.minSize)) {
            res = res && value.length >= field.minSize
        }
    }
    return res
}
