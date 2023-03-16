import * as lodash from "lodash"

export default async function (payload, state) {
    return lodash.has(payload, "body")
}
