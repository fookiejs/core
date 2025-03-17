import type { Model } from "@fookiejs/core/src/core/model/model.ts"
import type { Field } from "@fookiejs/core/src/core/field/field.ts"

export type SchemaType<model extends Model> = {
	[field in keyof model]: Field
}
