import { Type } from "../../core/type.ts"
import { Utils } from "../../utils/util.ts"
export const boolean: Type = Type.create({
	key: "boolean",
	validate: Utils.isBoolean,
	example: true,
	queryController: {
		equals: {
			key: "boolean",
			validate: Utils.isBoolean,
		},
		notEquals: {
			key: "boolean",
			validate: Utils.isBoolean,
		},
		isNull: {
			key: "boolean",
			validate: Utils.isBoolean,
		},
	},
	jsonType: "boolean",
}) as Type
