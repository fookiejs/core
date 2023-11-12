import * as lodash from "lodash"
import { TypeInterface } from "../../types"

const queryStructures = {
    stringQuery: `{
        equals: string,
        not: string,
        in: string[],
        not_in: string[],
        contains: string,
    }`,
    numberQuery: `{
        equals: number,
        not: number,
        in: number[],
        not_in: number[],
        lt: number,
        lte: number,
        gt: number,
        gte: number,
    }`,
    booleanQuery: `{
        equals: boolean,
        not: boolean,
    }`,
    dateQuery: `{
        equals: Date,
        not: Date,
        in: Date[],
        not_in: Date[],
        lt: Date,
        lte: Date,
        gt: Date,
        gte: Date,
    }`,
    bufferQuery: "{}",
    functionQuery: "{}",
    plainQuery: "{}",
    arrayQuery: function (typeFunc: TypeInterface) {
        return `{
            include: ${typeFunc.native}[],
            exclude: ${typeFunc.native}[],
        }`
    },
}

export const text: TypeInterface = {
    native: "string",
    controller: function (v) {
        return lodash.isString(v)
    },
    mock: "Helo",
    query: queryStructures.stringQuery,
}

export const float: TypeInterface = {
    native: "number",
    controller: function (v) {
        return lodash.isNumber(v)
    },
    mock: 0.1,
    query: queryStructures.numberQuery,
}

export const integer: TypeInterface = {
    native: "number",
    controller: function (v) {
        return Number.isInteger(v)
    },
    mock: 26,
    query: queryStructures.numberQuery,
}

export const boolean: TypeInterface = {
    native: "boolean",
    controller: function (v) {
        return lodash.isBoolean(v)
    },
    mock: true,
    query: queryStructures.booleanQuery,
}
export const buffer: TypeInterface = {
    native: "Buffer",
    controller: function (v) {
        return lodash.isBuffer(v)
    },
    mock: Buffer.from("fookie"),
    query: queryStructures.bufferQuery,
}

export const plain: TypeInterface = {
    native: "object",
    controller: function (v) {
        return lodash.isObject(v)
    },
    mock: {},
    query: queryStructures.plainQuery,
}

export const char: TypeInterface = {
    native: "string",
    controller: function (v) {
        return lodash.isString(v) && v.length == 1
    },

    mock: "a",
    query: queryStructures.stringQuery,
}
export const func: TypeInterface = {
    native: "Function",
    controller: function (v) {
        return lodash.isFunction(v)
    },
    mock: function () {
        return null
    },
    query: queryStructures.functionQuery,
}

export const array: (typeFunc: TypeInterface) => TypeInterface = function (typeFunc) {
    const func = function (v) {
        return lodash.isArray(v) && lodash.every(v, typeFunc.controller)
    }
    return {
        native: `${typeFunc.native}[]`,
        controller: func,
        mock: [typeFunc.mock],
        query: queryStructures.arrayQuery(typeFunc),
    }
}

export const date_type: TypeInterface = {
    native: "Date",
    controller: function (v) {
        const date = new Date(v)
        return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(v)
    },
    mock: new Date(),
    query: queryStructures.dateQuery,
}
export const time: TypeInterface = {
    native: "string",
    controller: function (v) {
        return /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/.test(v)
    },
    mock: "00:00",
    query: queryStructures.stringQuery,
}

export const date_time: TypeInterface = {
    native: "Date",
    controller: function (v) {
        const date = new Date(v)
        return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/.test(v)
    },
    mock: new Date(),
    query: queryStructures.dateQuery,
}
export const timestamp: TypeInterface = {
    native: "number",
    controller: function (v) {
        const date = new Date(v)
        return !isNaN(date.getTime())
    },
    mock: Date.now(),
    query: queryStructures.numberQuery,
}
