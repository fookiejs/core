=== Dosya: index.ts ===
export * from "./core/config"
export * from "./core/error"
export * from "./core/database"
export * from "./core/field"
export * from "./core/method"
export * from "./core/model"
export * from "./core/type"
export * from "./core/mixin"

export * from "./defaults/exports"


=== Dosya: base-class.ts ===
import { plainToClass } from "class-transformer"

export class BaseClass {
    static new<T extends BaseClass>(this: new () => T, data: T): T {
        return plainToClass(this, data)
    }
}


=== Dosya: config.ts ===
import { BaseClass } from "./base-class"

export class Config extends BaseClass {}


=== Dosya: database.ts ===
import { Model } from "./model"
import { Payload } from "./payload"
import { BaseClass } from "./base-class"
import * as Methods from "./method"

export class Database extends BaseClass {
    init!: <T extends typeof Model>(
        model: T,
    ) => {
        [Methods.CREATE]: (payload: Payload<InstanceType<T>>) => Promise<InstanceType<T>>
        [Methods.READ]: (payload: Payload<InstanceType<T>>) => Promise<InstanceType<T>[]>
        [Methods.UPDATE]: (payload: Payload<InstanceType<T>>) => Promise<boolean>
        [Methods.DELETE]: (payload: Payload<InstanceType<T>>) => Promise<boolean>
    }
}


=== Dosya: error.ts ===
import { BaseClass } from "./base-class"

export class Error extends BaseClass {}


=== Dosya: exceptions.ts ===
import { BaseClass } from "./base-class"
import { Modify, Role, Rule } from "./lifecycle"
import { Model } from "./model"

export class Exception<Entity extends Model> extends BaseClass {
    type: (typeof ExceptionType)[keyof typeof ExceptionType]
    role: Role<Entity>
    execute: Modify<Entity> | Rule<Entity>
}

export const ExceptionType = {
    ACCEPT: Symbol("ACCEPT"),
    REJECT: Symbol("REJECT"),
} as const


=== Dosya: field.ts ===
import { BaseClass } from "./base-class"
import { Model } from "./model"
import { Type } from "./type"

export class Field extends BaseClass {
    type: Type
    features: symbol[]
    relation: typeof Model
}


=== Dosya: lifecycle.ts ===
import { BaseClass } from "./base-class"
import { Model } from "./model"
import { Payload } from "./payload"

export class Rule<Entity extends typeof Model> extends BaseClass {
    key: string
    execute: (payload: Payload<Entity>) => Promise<boolean>
}

export class Role<Entity extends typeof Model> extends BaseClass {
    key: string
    execute: (payload: Payload<Entity>) => Promise<boolean>
}

export class Modify<Entity extends typeof Model> extends BaseClass {
    key: string
    execute: (payload: Payload<Entity>) => Promise<void>
}

export class Effect<Entity extends typeof Model> extends BaseClass {
    key: string
    execute: (payload: Payload<Entity>) => Promise<void>
}

export class Filter<Entity extends typeof Model> extends BaseClass {
    key: string
    execute: (payload: Payload<Entity>) => Promise<void>
}

export const Lifecycle = {
    RULE: Symbol(),
    ROLE: Symbol(),
    MODIFY: Symbol(),
    EFFECT: Symbol(),
    FILTER: Symbol(),
}


=== Dosya: method.ts ===
export const CREATE = Symbol("CREATE")
export const READ = Symbol("READ")
export const UPDATE = Symbol("UPDATE")
export const DELETE = Symbol("DELETE")


=== Dosya: mixin.ts ===
import { BaseClass } from "./base-class"

export class Mixin extends BaseClass {}


=== Dosya: model.ts ===
import { Database } from "./database"
import { Exception, ExceptionType } from "./exceptions"
import { Field } from "./field"
import { Lifecycle } from "./lifecycle"
import * as Methods from "./method"

export class Model {
    static database: Database
    id: string
    static lifecycle = {
        [Methods.CREATE]: {
            [Lifecycle.RULE]: [],
            [Lifecycle.ROLE]: [],
            [Lifecycle.MODIFY]: [],
            [Lifecycle.FILTER]: [],
            [Lifecycle.EFFECT]: [],
        },
        [Methods.READ]: {
            [Lifecycle.RULE]: [],
            [Lifecycle.ROLE]: [],
            [Lifecycle.MODIFY]: [],
            [Lifecycle.FILTER]: [],
            [Lifecycle.EFFECT]: [],
        },
        [Methods.UPDATE]: {
            [Lifecycle.RULE]: [],
            [Lifecycle.ROLE]: [],
            [Lifecycle.MODIFY]: [],
            [Lifecycle.FILTER]: [],
            [Lifecycle.EFFECT]: [],
        },
        [Methods.DELETE]: {
            [Lifecycle.RULE]: [],
            [Lifecycle.ROLE]: [],
            [Lifecycle.MODIFY]: [],
            [Lifecycle.FILTER]: [],
            [Lifecycle.EFFECT]: [],
        },
    }

    static fields: Field[] = []

    static exceptions = new Map<
        (typeof ExceptionType)[keyof typeof ExceptionType],
        Exception<Model>[]
    >([
        [ExceptionType.ACCEPT, []],
        [ExceptionType.REJECT, []],
    ])

    static create() {
        console.log("Default create method executed")
    }

    static read() {
        console.log("Default read method executed")
    }

    static update() {
        console.log("Default update method executed")
    }

    static delete() {
        console.log("Default delete method executed")
    }

    static addLifecycle(method: keyof typeof Methods, type: keyof typeof Lifecycle, handler: any) {
        this.lifecycle[method][type].push(handler)
    }

    static addException(exception: Exception<Model>) {
        this.exceptions.get(exception.type)!.push(exception)
    }

    static addField(field: Field) {
        this.fields.push(field)
    }
    static addDatabase(database: Database) {
        this.database = database

        const modelOperations = database.init(this)

        console.log(modelOperations)
    }
}


=== Dosya: payload.ts ===
import { Model } from "./model"
import * as Methods from "./method"

import { BaseClass } from "./base-class"
import { Field } from "./field"

export class Payload<T extends typeof Model> extends BaseClass {
    model: T
    method:
        | typeof Methods.CREATE
        | typeof Methods.READ
        | typeof Methods.UPDATE
        | typeof Methods.DELETE
    body: any
    query: {
        filter: {
            [key in keyof T]?: {
                equals: undefined
                notEquals: undefined
                like: boolean
                gte?: T[key]
                lte?: T[key]
                gt?: T[key]
                lt?: T[key]
                in?: T[key][]
                notIn?: T[key][]
            }
        }
        offset: number
        limit: number
        attributes: Field[]
    }
    options: {
        token: string
    }
}


=== Dosya: type.ts ===
import { BaseClass } from "./base-class"

export class Type extends BaseClass {}


=== Dosya: field.ts ===


=== Dosya: model.ts ===


=== Dosya: exports.ts ===
import { store } from "./database/store"
import { text } from "./type/text"
import { integer } from "./type/integer"
import { nobody } from "./role/nobody"
import { everybody } from "./role/everybody"
import { date } from "./type/date"
import { timestamp } from "./type/timestamp"
import { time } from "./type/time"
import { float } from "./type/float"
import { boolean } from "./type/boolean"
import { array } from "./type/array"

export const defaults = {
    type: {
        integer,
        text,
        date,
        timestamp,
        time,
        float,
        boolean,
        array,
    },
    database: {
        store,
    },
    role: {
        nobody,
        everybody,
    },
}


=== Dosya: store.ts ===
import { Database } from "../../core/database"
import * as Methods from "../../core/method"

export const store = Database.new({
    init: function (Model) {
        return {
            [Methods.CREATE]: async () => {
                const entity = new Model()
                entity.id
                return entity
            },
            [Methods.READ]: async () => {
                return []
            },
            [Methods.UPDATE]: async () => {
                return true
            },
            [Methods.DELETE]: async () => {
                return true
            },
        }
    },
})


=== Dosya: everybody.ts ===
import { Role } from "../../core/lifecycle"

export const everybody = Role.new({
    key: "everybody",
    execute: async function () {
        return true
    },
})


=== Dosya: nobody.ts ===
import { Role } from "../../core/lifecycle"

export const nobody = Role.new({
    key: "nobody",
    execute: async () => false,
})


=== Dosya: read_only.ts ===
import { Role } from "../../core/lifecycle"
import { Methods } from "../../core/method"

export const readOnly = Role.new({
    key: "read_only",
    execute: async function (payload) {
        return payload.method === Methods.READ
    },
})


=== Dosya: write_only.ts ===
import { Role } from "../../core/lifecycle"
import { Methods } from "../../core/method"

export const writeOnly = Role.new({
    key: "write_only",
    execute: async function (payload) {
        return payload.method === Methods.CREATE || payload.method === Methods.UPDATE
    },
})


=== Dosya: array.ts ===
import * as lodash from "lodash"
import { Type } from "../../core/type"

export const array = (innerType: Type) => {
    return Type.new({
        key: `${innerType.key}[]`,
        validate: (value) => lodash.isArray(value) && value.every(innerType.validate),
        example: [innerType.example],
        queryController: {},
    })
}


=== Dosya: boolean.ts ===
import { Type } from "../../core/type"
import * as lodash from "lodash"

export const boolean = Type.new({
    key: "boolean",
    validate: lodash.isBoolean,
    example: true,
    queryController: {
        equals: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
        notEquals: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
})


=== Dosya: date.ts ===
import { Type } from "../../core/type"
import * as lodash from "lodash"
import moment from "moment"

function isDate(value: unknown) {
    if (!lodash.isString(value)) return false
    return moment(value, "YYYY-MM-DD", true).isValid()
}

export const date = Type.new({
    key: "date",
    validate: isDate,
    example: new Date("2023-01-01"),
    queryController: {
        equals: {
            key: "date",
            validate: isDate,
        },
        notEquals: {
            key: "date",
            validate: isDate,
        },
        in: {
            key: "date",
            validate: isDate,
            isArray: true,
        },
        notIn: {
            key: "date",
            validate: isDate,
            isArray: true,
        },
        lt: {
            key: "date",
            validate: isDate,
        },
        lte: {
            key: "date",
            validate: isDate,
        },
        gt: {
            key: "date",
            validate: isDate,
        },
        gte: {
            key: "date",
            validate: isDate,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
})


=== Dosya: float.ts ===
import { Type } from "../../core/type"
import * as lodash from "lodash"

export const float = Type.new({
    key: "float",
    validate: function (value: unknown): boolean {
        return lodash.isNumber(value)
    },
    example: 1,
    queryController: {
        equals: {
            key: "float",
            validate: lodash.isNumber,
        },
        notEquals: {
            key: "float",
            validate: lodash.isNumber,
        },

        gte: { key: "float", validate: lodash.isNumber },
        gt: { key: "float", validate: lodash.isNumber },
        lte: { key: "float", validate: lodash.isNumber },
        lt: { key: "float", validate: lodash.isNumber },
        in: {
            key: "float",
            validate: lodash.isNumber,
            isArray: true,
        },
        notIn: {
            key: "float",
            validate: lodash.isNumber,
            isArray: true,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
})


=== Dosya: integer.ts ===
import { Type } from "../../core/type"
import * as lodash from "lodash"

export const integer = Type.new({
    key: "int",
    validate: function (value: unknown): boolean {
        return lodash.isInteger(value)
    },
    example: 1,
    queryController: {
        equals: {
            key: "int",
            validate: lodash.isInteger,
        },
        notEquals: {
            key: "int",
            validate: lodash.isInteger,
        },

        gte: { key: "int", validate: lodash.isInteger },
        gt: { key: "int", validate: lodash.isInteger },
        lte: { key: "int", validate: lodash.isInteger },
        lt: { key: "int", validate: lodash.isInteger },
        in: {
            key: "int",
            validate: lodash.isInteger,
            isArray: true,
        },
        notIn: {
            key: "int",
            validate: lodash.isInteger,
            isArray: true,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
        isNotNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
})


=== Dosya: text.ts ===
import { Type } from "../../core/type"
import * as lodash from "lodash"

export const text = Type.new({
    key: "string",
    validate: lodash.isString,
    example: "abc",
    queryController: {
        equals: {
            key: "string",
            validate: lodash.isString,
        },
        notEquals: {
            key: "string",
            validate: lodash.isString,
        },
        in: {
            key: "string",
            validate: lodash.isString,
            isArray: true,
        },
        notIn: {
            key: "string",
            validate: lodash.isString,
            isArray: true,
        },
        like: {
            key: "string",
            validate: lodash.isString,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
        isNotNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
})


=== Dosya: time.ts ===
import { Type } from "../../core/type"
import * as lodash from "lodash"

function isTime(value: unknown) {
    if (!lodash.isString(value)) return false
    const timePatternFull = /^\d{2}:\d{2}:\d{2}$/ // Saat, dakika ve saniye
    const timePatternShort = /^\d{2}:\d{2}$/ // Sadece saat ve dakika
    return timePatternFull.test(value) || timePatternShort.test(value)
}

export const time = Type.new({
    key: "time",
    validate: isTime,
    example: "14:30",
    queryController: {
        equals: {
            key: "time",
            validate: isTime,
        },
        notEquals: {
            key: "time",
            validate: isTime,
        },
        in: {
            key: "time",
            validate: isTime,
            isArray: true,
        },
        notIn: {
            key: "time",
            validate: isTime,
            isArray: true,
        },
        lt: {
            key: "time",
            validate: isTime,
        },
        lte: {
            key: "time",
            validate: isTime,
        },
        gt: {
            key: "time",
            validate: isTime,
        },
        gte: {
            key: "time",
            validate: isTime,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
})


=== Dosya: timestamp.ts ===
import { Type } from "../../core/type"
import * as lodash from "lodash"

function isTimestamp(value: unknown) {
    if (!lodash.isString(value)) return false
    const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
    return timestampPattern.test(value)
}

export const timestamp = Type.new({
    key: "timestamp",
    validate: isTimestamp,
    example: new Date().toISOString(),
    queryController: {
        equals: {
            key: "timestamp",
            validate: isTimestamp,
        },
        notEquals: {
            key: "timestamp",
            validate: isTimestamp,
        },
        in: {
            key: "timestamp",
            validate: isTimestamp,
            isArray: true,
        },
        notIn: {
            key: "timestamp",
            validate: isTimestamp,
            isArray: true,
        },
        lt: {
            key: "timestamp",
            validate: isTimestamp,
        },
        lte: {
            key: "timestamp",
            validate: isTimestamp,
        },
        gt: {
            key: "timestamp",
            validate: isTimestamp,
        },
        gte: {
            key: "timestamp",
            validate: isTimestamp,
        },
        isNull: {
            key: "boolean",
            validate: lodash.isBoolean,
        },
    },
})


