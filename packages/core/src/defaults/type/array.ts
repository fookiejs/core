import { Type } from "../../core/type.ts"

export const array = (innerType: Type): Type => {
	return Type.create({
		key: `${innerType.key}[]`,

		validate: (value: any) => Array.isArray(value) && value.every(innerType.validate),
		example: [innerType.example],
		queryController: {},
		alias: ["array"],
	})
}
