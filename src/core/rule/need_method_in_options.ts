import * as lodash from "lodash"

export default async function (payload, ctx) {
    return lodash.has(payload.options, "method") && typeof payload.options.method == "string"
}
