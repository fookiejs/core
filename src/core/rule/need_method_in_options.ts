import { lifecycle } from "../.."

export default async function (payload, ctx) {
    return ctx.lodash.has(payload.options, "method") && typeof payload.options.method == "string"
}
