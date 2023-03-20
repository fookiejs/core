import * as lodash from "lodash"
import { LifecycleFunction } from "@fookie/core"

export const everybody: LifecycleFunction = async function (payload, state) {
    return true
}

export const nobody: LifecycleFunction = async function (payload, state) {
    return false
}

export const system: LifecycleFunction = async function (payload, state) {
    return (
        lodash.isString(payload.token) && lodash.isString(process.env.SYSTEM_TOKEN) && process.env.SYSTEM_TOKEN === payload.token
    )
}
