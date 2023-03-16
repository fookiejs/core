import { lifecycle } from "../.."

export default async function (payload, state) {
    return ctx.lodash.has(payload, "body")
}
