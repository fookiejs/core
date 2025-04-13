import type { Field } from "../field.ts"

export function fillSchema(field: Field): Field {
	if (!Object.hasOwn(field, "features")) {
		field.features = []
	}

	return field
}
