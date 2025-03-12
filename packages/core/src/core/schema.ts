import { Model } from "@fookiejs/core"
import { Field } from "./field/field"

export type SchemaType<model extends Model> = {
    [field in keyof model]: Field
}
