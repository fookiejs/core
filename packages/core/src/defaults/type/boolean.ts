import { Type } from "../../core/type.ts"

import * as lodash from "npm:lodash@^4.17.21"
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
