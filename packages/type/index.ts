import * as lodash from "lodash"
import { Type } from "../../types"

export const Text: Type = function (v) {
    return lodash.isString(v)
}

export const Float: Type = function (v) {
    return lodash.isNumber(v)
}

export const Integer: Type = function (v) {
    return Number.isInteger(v)
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

export const Timestamp: Type = function (v) {
    return !!new Date(v)
}

export const StringArray = function (v) {
    return lodash.isArray(v) && lodash.every(v, lodash.isString)
}

export const FloatArray = function (v) {
    return (
        lodash.isArray(v) &&
        lodash.every(v, (element) => {
            return lodash.isNumber(v)
        })
    )
}

export const IntegerArray = function (v) {
    return lodash.isArray(v) && lodash.every(v, Number.isInteger)
}
