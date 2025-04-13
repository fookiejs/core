import { Field } from "../field/field.ts"
import { Model } from "./model.ts"

export type SchemaType<model extends Model> = {
	[field in keyof model]: Field
}
