import type { Field } from "../field.ts"
import { TypeStandartization } from "../../type/standartization.ts"
import { CoreTypes } from "../../defaults/type/types.ts"

export function fillSchema(field: Field): Field {
	if (!Object.hasOwn(field, "features")) {
		field.features = []
	}

	if (field.type && field.enum && field.type === TypeStandartization.Enum) {
		CoreTypes[field.type].example = Object.values(field.enum)[0]
		CoreTypes[field.type].validate = (value: any) => Object.values(field.enum!).includes(value)
	}

	return field
}
