import { Model } from "../exports"
import { Field } from "./field/field"

export type SchemaType<ModelClass extends Model> = {
    [field in keyof ModelClass]: Field
}
