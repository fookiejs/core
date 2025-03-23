import { Type } from "../../core/type.ts"
import { Utils } from "../../utils/util.ts"
export const boolean: Type = Type.create({
	key: "boolean",
	validate: Utils.isBoolean,
	example: true,
	queryController: {
		equals: {
			key: "boolean",
		},
		notEquals: {
			key: "boolean",
		},
		isNull: {
			key: "boolean",
		},
	},
	alias: ["boolean"],
}) as Type
