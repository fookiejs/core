import * as lodash from "lodash"
import { Type } from "../../types"

export const Text: Type = function (v) {
    return lodash.isString(v)
}
export const Number: Type = function (v) {
    return lodash.isNumber(v)
}
export const Array: Type = function (v) {
    return lodash.isArray(v)
}
export const Boolean: Type = function (v) {
    return lodash.isBoolean(v)
}
export const Buffer: Type = function (v) {
    return lodash.isBuffer(v)
}
export const Plain: Type = function (v) {
    return lodash.isObject(v)
}
export const Char: Type = function (v) {
    return lodash.isString(v) && v.length == 1
}
export const Function: Type = function (v) {
    return lodash.isFunction(v)
}
