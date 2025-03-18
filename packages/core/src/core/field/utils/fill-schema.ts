import { string } from "../../../defaults/type/string.ts"
import type { Field } from "../field.ts"

export function fillSchema(field: Field): Field {
	if (!Object.hasOwn(field, "type")) {
		field.type = string
	}

	if (!Object.hasOwn(field, "features")) {
		field.features = []
	}

	if (field.relation) {
		field.type = string
	}

	return field
}
