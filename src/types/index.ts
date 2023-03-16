import * as lodash from "lodash"

export const Text: Type = (v) => lodash.isString(v)

export const Number: Type = (v) => lodash.isNumber(v)

export const Array: Type = (v) => lodash.isArray(v)

export const Boolean: Type = (v) => lodash.isBoolean(v)

export const Buffer: Type = (v) => lodash.isBuffer(v)

export const Any: Type = (v) => lodash.isObject(v)

export const Char: Type = (v) => lodash.isString(v) && v.length == 1

export const Function: Type = (v) => lodash.isFunction(v)
