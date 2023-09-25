import * as lodash from "lodash"
import { TypeInterface } from "../../types"

export const Text: TypeInterface = function (v) {
    return lodash.isString(v)
}

export const Float: TypeInterface = function (v) {
    return lodash.isNumber(v)
}

export const Integer: TypeInterface = function (v) {
    return Number.isInteger(v)
}

export const Boolean: TypeInterface = function (v) {
    return lodash.isBoolean(v)
}

export const Buffer: TypeInterface = function (v) {
    return lodash.isBuffer(v)
}

export const Plain: TypeInterface = function (v) {
    return lodash.isObject(v)
}

export const Char: TypeInterface = function (v) {
    return lodash.isString(v) && v.length == 1
}

export const Function: TypeInterface = function (v) {
    return lodash.isFunction(v)
}

export const Array: (typeFunc: TypeInterface) => TypeInterface = function (typeFunc) {
    const func = function (v) {
        return lodash.isArray(v) && lodash.every(v, typeFunc)
    }
    func.array_type = typeFunc
    return func
}

export const DateType: TypeInterface = function (v) {
    const date = new Date(v)
    return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

export const Time: TypeInterface = function (v) {
    return /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/.test(v)
}

export const DateTime: TypeInterface = function (v) {
    const date = new Date(v)
    return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/.test(v)
}

export const Timestamp: TypeInterface = function (v) {
    const date = new Date(v)
    return !isNaN(date.getTime())
}
