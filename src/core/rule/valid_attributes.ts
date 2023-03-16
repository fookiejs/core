import { lifecycle } from "../.."

export default async function (payload, state) {
    const model = ctx.local.get("model", payload.model)
    return payload.query.attributes.every(function (k) {
        return ctx.lodash.keys(model.schema).includes(k)
    })
}
