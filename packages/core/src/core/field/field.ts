import * as lodash from "lodash"
import { string } from "../../defaults/type/string"
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
    features?: symbol[]

    static Decorator(field: Field) {
        return function (target: any, propertyKey: any) {
            const metadata = Reflect.getMetadata(schemaSymbol, target.constructor) || {}

            if (!lodash.has(metadata, "id")) {
                metadata["id"] = fillSchema({
                    type: string,
                })
            }

            metadata[propertyKey] = fillSchema(field)

            Reflect.defineMetadata(schemaSymbol, metadata, target.constructor)
        }
    }
}
