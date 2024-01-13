import * as lodash from "lodash"
import { TypeInterface } from "../../types"

export const text: TypeInterface = {
    native: "string",
    controller: (v: unknown) => lodash.isString(v),
    mock: "Hello",
    query: {
        equals: "string",
        not: "string",
        in: "string[]",
        not_in: "string[]",
        contains: "string",
    },
    query_controller: function (field_query: unknown) {
        return (
            lodash.every(
                ["in", "not_in"],
                (value) => lodash.isArray(field_query[value]) && lodash.every(field_query[value], (str) => lodash.isString(str))
            ) && lodash.every(["equals", "not", "contains"], (value) => lodash.isString(field_query[value]))
        )
    },
}

export const float: TypeInterface = {
    native: "number",
    controller: (v: unknown) => lodash.isNumber(v),
    mock: 123,
    query: {
        equals: "number",
        not: "number",
        in: "number[]",
        not_in: "number[]",
        lt: "number",
        lte: "number",
        gt: "number",
        gte: "number",
    },
    query_controller: function (field_query: unknown) {
        return (
            lodash.every(
                ["in", "not_in"],
                (value) => lodash.isArray(field_query[value]) && lodash.every(field_query[value], (str) => lodash.isNumber(str))
            ) && lodash.every(["equals", "not", "lt", "lte", "gt", "gte"], (value) => lodash.isNumber(field_query[value]))
        )
    },
}

export const integer: TypeInterface = {
    native: "number",
    controller: (v: unknown) => lodash.isNumber(v),
    mock: 1.5,
    query: {
        equals: "number",
        not: "number",
        in: "number[]",
        not_in: "number[]",
        lt: "number",
        lte: "number",
        gt: "number",
        gte: "number",
    },
    query_controller: function (field_query: unknown) {
        return (
            lodash.every(
                ["in", "not_in"],
                (value) => lodash.isArray(field_query[value]) && lodash.every(field_query[value], (str) => lodash.isNumber(str))
            ) && lodash.every(["equals", "not", "lt", "lte", "gt", "gte"], (value) => lodash.isNumber(field_query[value]))
        )
    },
}

export const boolean: TypeInterface = {
    native: "boolean",
    controller: (v: unknown) => lodash.isBoolean(v),
    mock: true,
    query: {
        equals: "boolean",
        not: "boolean",
    },
    query_controller: function (field_query: unknown) {
        return lodash.every(["equals", "not"], (value) => lodash.isBoolean(field_query[value]))
    },
}

export const buffer: TypeInterface = {
    native: "Buffer",
    controller: function (v: unknown): boolean {
        return lodash.isBuffer(v)
    },
    mock: Buffer.from("fookie"),
    query: "never",
    query_controller: function () {
        return false
    },
}

export const plain: TypeInterface = {
    native: "object",
    controller: function (v: unknown): boolean {
        return lodash.isObject(v) && !lodash.isArray(v) && !lodash.isFunction(v)
    },
    mock: {},
    query: "never",
    query_controller: function () {
        return false
    },
}

export const char: TypeInterface = {
    native: "string",
    controller: function (v: unknown): boolean {
        return lodash.isString(v) && v.length === 1
    },
    mock: "a",
    query: {
        equals: "string",
        not: "string",
        in: "string[]",
        not_in: "string[]",
        contains: "string",
    },
    query_controller: function (field_query: unknown) {
        return (
            lodash.every(
                ["in", "not_in"],
                (value) => lodash.isArray(field_query[value]) && lodash.every(field_query[value], (str) => lodash.isString(str))
            ) && lodash.every(["equals", "not", "contains"], (value) => lodash.isString(field_query[value]))
        )
    },
}

export const func: TypeInterface = {
    native: "Function",
    controller: function (v: unknown): boolean {
        return lodash.isFunction(v)
    },
    mock: function () {
        return null
    },
    query: "never",
    query_controller: function () {
        return false
    },
}

export const date_type: TypeInterface = {
    native: "Date",
    controller: function (v: any): boolean {
        const date = new Date(v)
        return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(v)
    },
    mock: new Date(),
    query: {
        equals: "Date",
        not: "Date",
        in: "Date[]",
        not_in: "Date[]",
        lt: "Date",
        lte: "Date",
        gt: "Date",
        gte: "Date",
    },
    query_controller: function (field_query: unknown) {
        return (
            lodash.every(
                ["in", "not_in"],
                (value) =>
                    lodash.isArray(field_query[value]) && lodash.every(field_query[value], (str) => date_type.controller(str))
            ) && lodash.every(["equals", "not", "lt", "lte", "gt", "gte"], (value) => date_type.controller(field_query[value]))
        )
    },
}

export const time: TypeInterface = {
    native: "string",
    controller: function (v: any): boolean {
        return /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/.test(v)
    },
    mock: "00:00",
    query: {
        equals: "string",
        not: "string",
        in: "string[]",
        not_in: "string[]",
        contains: "string",
    },
    query_controller: function (field_query: unknown) {
        return (
            lodash.every(
                ["in", "not_in"],
                (value) => lodash.isArray(field_query[value]) && lodash.every(field_query[value], (str) => time.controller(str))
            ) && lodash.every(["equals", "not", "contains"], (value) => time.controller(field_query[value]))
        )
    },
}

export const date_time: TypeInterface = {
    native: "Date",
    controller: function (v: any): boolean {
        const date = new Date(v)
        return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d+)?$/.test(v)
    },
    mock: new Date(),
    query: {
        equals: "Date",
        not: "Date",
        in: "Date[]",
        not_in: "Date[]",
        lt: "Date",
        lte: "Date",
        gt: "Date",
        gte: "Date",
    },
    query_controller: function (field_query: unknown) {
        return (
            lodash.every(
                ["in", "not_in"],
                (value) =>
                    lodash.isArray(field_query[value]) && lodash.every(field_query[value], (str) => date_time.controller(str))
            ) && lodash.every(["equals", "not", "lt", "lte", "gt", "gte"], (value) => date_time.controller(field_query[value]))
        )
    },
}

export const timestamp: TypeInterface = {
    native: "number",
    controller: function (v: any): boolean {
        const date = new Date(v)
        return !isNaN(date.getTime())
    },
    mock: Date.now(),
    query: {
        equals: "number",
        not: "number",
        in: "number[]",
        not_in: "number[]",
        lt: "number",
        lte: "number",
        gt: "number",
        gte: "number",
    },
    query_controller: function (field_query: unknown) {
        return (
            lodash.every(
                ["in", "not_in"],
                (value) =>
                    lodash.isArray(field_query[value]) && lodash.every(field_query[value], (str) => timestamp.controller(str))
            ) && lodash.every(["equals", "not", "lt", "lte", "gt", "gte"], (value) => timestamp.controller(field_query[value]))
        )
    },
}

export const array: (typeFunc: TypeInterface) => TypeInterface = function (typeFunc) {
    const controller_func = function (v: any[]): boolean {
        return lodash.isArray(v) && lodash.every(v, typeFunc.controller)
    }

    return {
        native: `${typeFunc.native}[]`,
        controller: controller_func,
        mock: [typeFunc.mock],
        query: {
            include: `${typeFunc.native}[]`,
            exclude: `${typeFunc.native}[]`,
        },
        query_controller: function (field_query: unknown): boolean {
            return lodash.every(
                ["include", "exclude"],
                (value) => lodash.isArray(field_query[value]) && lodash.every(field_query[value], typeFunc.query_controller)
            )
        },
    }
}
