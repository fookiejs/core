import { Type } from "../../core/type.ts"

import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
export const boolean: Type = Type.create({
	key: "boolean",
	validate: lodash.isBoolean,
	example: true,
	queryController: {
		equals: {
			key: "boolean",
			validate: lodash.isBoolean,
		},
		notEquals: {
			key: "boolean",
			validate: lodash.isBoolean,
		},
		isNull: {
			key: "boolean",
			validate: lodash.isBoolean,
		},
	},
	jsonType: "boolean",
}) as Type
