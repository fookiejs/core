import { Type } from "../../core/type.ts"
import { Utils } from "../../utils/util.ts"

export const string: Type = Type.create({
	key: "string",
	alias: ["string"],
	validate: Utils.isString,
	example: "abc",
	queryController: {
		equals: {
			key: "string",
		},
		notEquals: {
			key: "string",
		},
		in: {
			key: "string",
			isArray: true,
		},
		notIn: {
			key: "string",

			isArray: true,
		},
		like: {
			key: "string",
		},
		isNull: {
			key: "boolean",
		},
		isNotNull: {
			key: "boolean",
		},
	},
}) as Type
