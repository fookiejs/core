import * as lodash from "lodash"
import { LifecycleFunction } from "../../types"

export const everybody: LifecycleFunction = async function () {
    return true
}

export const nobody: LifecycleFunction = async function () {
    return false
}

export const system: LifecycleFunction = async function (payload) {
    return (
        lodash.isString(payload.token) && lodash.isString(process.env.SYSTEM_TOKEN) && process.env.SYSTEM_TOKEN === payload.token
    )
}
