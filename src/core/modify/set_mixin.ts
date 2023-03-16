import * as lodash from "lodash"

export default async function (payload, state) {
    if (payload.body.mixins) {
        payload.body = deepMerge(ctx.local.get("mixin", "after").object, payload.body)
        for (const i of payload.body.mixins) {
            const mixin = ctx.local.get("mixin", i)
            payload.body = deepMerge(payload.body, mixin.object)
        }
        payload.body = deepMerge(ctx.local.get("mixin", "before").object, payload.body)
    }
}
