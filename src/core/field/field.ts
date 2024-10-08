import * as lodash from "lodash"
import { text } from "../../defaults/type/text"
import { Role } from "../lifecycle-function"
import { Model, schemaSymbol } from "../model/model"
import { Type } from "../type"
import { fillSchema } from "./utils/fill-schema"

export class Field {
    required?: boolean
    type?: Type
    unique?: boolean
    uniqueGroup?: string[]
    default?: unknown
    validators?: [(value: unknown) => boolean | string]
    relation?: typeof Model
    read?: Role<any>[]
    write?: Role<any>[]
    cascadeDelete?: boolean
    features?: symbol[]

    static Decorator(field: Field) {
        return function (target: any, propertyKey: any) {
            const metadata = Reflect.getMetadata(schemaSymbol, target.constructor) || {}

            if (!lodash.has(metadata, "id")) {
                metadata["id"] = fillSchema({
                    type: text,
                })
            }

            metadata[propertyKey as string] = fillSchema(field)

            Reflect.defineMetadata(schemaSymbol, metadata, target.constructor)
        }
    }
}

export const Required = Symbol()
export const Unique = Symbol()
export const CascadeDelete = Symbol()
