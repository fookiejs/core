import { Type } from "../../core/type.ts"
import { Utils } from "../../utils/util.ts"

export const number: Type = Type.create({
	key: "number",
	jsonType: "number",
	validate: function (value: unknown): boolean {
		return Utils.isNumber(value)
	},
	example: 1,
	queryController: {
		equals: {
			key: "number",
			validate: Utils.isNumber,
		},
		notEquals: {
			key: "number",
			validate: Utils.isNumber,
		},

		gte: { key: "number", validate: Utils.isNumber },
		gt: { key: "number", validate: Utils.isNumber },
		lte: { key: "number", validate: Utils.isNumber },
		lt: { key: "number", validate: Utils.isNumber },
		in: {
			key: "number",
			validate: Utils.isNumber,
			isArray: true,
		},
		notIn: {
			key: "number",
			validate: Utils.isNumber,
			isArray: true,
		},
		isNull: {
			key: "boolean",
			validate: Utils.isBoolean,
		},
	},
}) as Type
