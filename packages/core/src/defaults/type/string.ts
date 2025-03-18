import { Type } from "../../core/type.ts"
import { Utils } from "../../utils/util.ts"

export const string: Type = Type.create({
	key: "string",
	jsonType: "string",
	validate: Utils.isString,
	example: "abc",
	queryController: {
		equals: {
			key: "string",
			validate: Utils.isString,
		},
		notEquals: {
			key: "string",
			validate: Utils.isString,
		},
		in: {
			key: "string",
			validate: Utils.isString,
			isArray: true,
		},
		notIn: {
			key: "string",
			validate: Utils.isString,
			isArray: true,
		},
		like: {
			key: "string",
			validate: Utils.isString,
		},
		isNull: {
			key: "boolean",
			validate: Utils.isBoolean,
		},
		isNotNull: {
			key: "boolean",
			validate: Utils.isBoolean,
		},
	},
}) as Type
