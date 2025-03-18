import { Type } from "../../core/type.ts"

import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
export const string: Type = Type.create({
	key: "string",
	jsonType: "string",
	validate: lodash.isString,
	example: "abc",
	queryController: {
		equals: {
			key: "string",
			validate: lodash.isString,
		},
		notEquals: {
			key: "string",
			validate: lodash.isString,
		},
		in: {
			key: "string",
			validate: lodash.isString,
			isArray: true,
		},
		notIn: {
			key: "string",
			validate: lodash.isString,
			isArray: true,
		},
		like: {
			key: "string",
			validate: lodash.isString,
		},
		isNull: {
			key: "boolean",
			validate: lodash.isBoolean,
		},
		isNotNull: {
			key: "boolean",
			validate: lodash.isBoolean,
		},
	},
}) as Type
