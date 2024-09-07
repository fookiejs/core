import * as lodash from "lodash"
import { text } from "../../defaults/type/text"
import { Role } from "../lifecycle-function"
import { Model } from "../model/model"
import { Type } from "../type"
import { fillSchema } from "./utils/fill-schema"
import "reflect-metadata" // Ensure reflect-metadata is imported

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

    static Decorator(field: Field) {
        return function (target: any, propertyKey: any) {
            const metadata = Reflect.getMetadata("schema", target.constructor) || {}

            if (!lodash.has(metadata, "id")) {
                metadata["id"] = fillSchema({
                    type: text,
                })
            }

            metadata[propertyKey as string] = fillSchema(field)

            Reflect.defineMetadata("schema", metadata, target.constructor)
        }
    }
}
