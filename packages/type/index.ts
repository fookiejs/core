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

export const Array: (typeFunc: Type) => Type = function (typeFunc) {
    return function (v) {
        return lodash.isArray(v) && lodash.every(v, typeFunc)
    }
}

export const DateType: Type = function (v) {
    const date = new Date(v)
    return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

export const Time: Type = function (v) {
    return /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/.test(v)
}

export const DateTime: Type = function (v) {
    const date = new Date(v)
    return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/.test(v)
}

export const Timestamp: Type = function (v) {
    const date = new Date(v)
    return !isNaN(date.getTime())
}
