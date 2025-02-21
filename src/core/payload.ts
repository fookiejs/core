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
