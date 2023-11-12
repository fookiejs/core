import * as lodash from "lodash"
import { TypeInterface } from "../../types"

export const Text: TypeInterface = {
    name: "text",
    controller: function (v) {
        return lodash.isString(v)
    },
    mock: "Helo",
}

export const Float: TypeInterface = {
    name: "float",
    controller: function (v) {
        return lodash.isNumber(v)
    },
    mock: 0.1,
}

export const Integer: TypeInterface = {
    name: "integer",
    controller: function (v) {
        return Number.isInteger(v)
    },
    mock: "",
}

export const Boolean: TypeInterface = {
    name: "boolean",
    controller: function (v) {
        return lodash.isBoolean(v)
    },
    mock: "",
}
export const Buffer: TypeInterface = {
    name: "buffer",
    controller: function (v) {
        return lodash.isBuffer(v)
    },
    mock: "",
}

export const Plain: TypeInterface = {
    name: "plain",
    controller: function (v) {
        return lodash.isObject(v)
    },
    mock: "",
}

export const Char: TypeInterface = {
    name: "char",
    controller: function (v) {
        return lodash.isString(v) && v.length == 1
    },

    mock: "a",
}
export const Function: TypeInterface = {
    name: "function",
    controller: function (v) {
        return lodash.isFunction(v)
    },
    mock: function () {
        return null
    },
}

export const Array: (typeFunc: TypeInterface) => TypeInterface = function (typeFunc) {
    const func = function (v) {
        return lodash.isArray(v) && lodash.every(v, typeFunc.controller)
    }
    func.array_type = typeFunc
    return {
        name: "array",
        controller: func,
        mock: [],
    }
}

export const DateType: TypeInterface = {
    name: "float",
    controller: function (v) {
        const date = new Date(v)
        return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(v)
    },

    mock: new Date(),
}
export const Time: TypeInterface = {
    name: "time",
    controller: function (v) {
        return /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/.test(v)
    },
    mock: "00:00",
}

export const DateTime: TypeInterface = {
    name: "float",
    controller: function (v) {
        const date = new Date(v)
        return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/.test(v)
    },

    mock: new Date(),
}
export const Timestamp: TypeInterface = {
    name: "float",
    controller: function (v) {
        const date = new Date(v)
        return !isNaN(date.getTime())
    },
    mock: Date.now(),
}
