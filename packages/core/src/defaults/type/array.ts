import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
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
