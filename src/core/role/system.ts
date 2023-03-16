import * as lodash from "lodash"

export default async function (payload, state) {
    return lodash.isString(process.env.SYSTEM_TOKEN) && process.env.SYSTEM_TOKEN === payload.token
}
