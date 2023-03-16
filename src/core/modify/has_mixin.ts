import * as lodash from "lodash"

export default async function (payload, state) {
    if (payload.body.mixins) {
        for (const i of payload.body.mixins) {
            if (!ctx.local.has("mixin", i)) {
                return false
            }
        }
    }
}
