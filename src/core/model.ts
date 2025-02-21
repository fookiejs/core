import { Database } from "./database"
import { Exception, ExceptionType } from "./exceptions"
import { Field } from "./field"
import { Lifecycle } from "./lifecycle"
import * as Methods from "./method"
import { Query } from "./query"

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

    static read(query: Query, options: Options) {
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
