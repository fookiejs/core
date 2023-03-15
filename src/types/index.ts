import * as lodash from "lodash"

export const Text: Type = (v) => lodash.isString

export const Number: Type = (v) => lodash.isNumber

export const Array: Type = (v) => lodash.isArray

export const Boolean: Type = (v) => lodash.isBoolean

export const Buffer: Type = (v) => lodash.isBuffer

export const Any: Type = (v) => lodash.isObject

export const Char: Type = (v) =>
    function (v) {
        return lodash.isString(v) && v.length == 1
    }
export const Function: Type = (v) => lodash.isFunction
