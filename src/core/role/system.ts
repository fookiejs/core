import { lifecycle } from "../.."

export default async function (payload, state) {
    return ctx.lodash.isString(process.env.SYSTEM_TOKEN) && process.env.SYSTEM_TOKEN === payload.token
}
