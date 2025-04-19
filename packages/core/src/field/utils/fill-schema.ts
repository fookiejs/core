import type { Field } from "../field.ts"
import { TypeStandartization } from "../../type/standartization.ts"

export function fillSchema(field: Field): Field {
	if (!Object.hasOwn(field, "features")) {
		field.features = []
	}

	if (field.type && field.enum && field.type.type === TypeStandartization.Enum) {
		field.type.example = Object.values(field.enum)[0]
		field.type.validate = (value: any) => Object.values(field.enum!).includes(value)
	}

	return field
}
