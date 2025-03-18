import type { Model } from "./model/model.ts"
import type { Field } from "./field/field.ts"

export type SchemaType<model extends Model> = {
	[field in keyof model]: Field
}
