import { Field } from "./field/field"

export type SchemaType<T> = {
    [field in keyof T]: Field
}
