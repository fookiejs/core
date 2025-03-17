import * as lodash from "npm:lodash@^4.17.21"
import { Type } from "../../core/type.ts"

export const array = (innerType: Type): Type => {
	return Type.create({
		key: `${innerType.key}[]`,

		validate: (value: any) => lodash.isArray(value) && value.every(innerType.validate),
		example: [innerType.example],
		queryController: {},
		jsonType: "array",
	})
}
