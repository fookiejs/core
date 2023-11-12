import { LifecycleFunction, Method } from "../../types"
import * as lodash from "lodash"

export const everybody: LifecycleFunction<unknown, Method> = async function () {
    return true
}

export const nobody: LifecycleFunction<unknown, Method> = async function () {
    return false
}

export const system: LifecycleFunction<unknown, Method> = async function (payload) {
    return (
        lodash.isString(payload.token) && lodash.isString(process.env.SYSTEM_TOKEN) && process.env.SYSTEM_TOKEN === payload.token
    )
}
