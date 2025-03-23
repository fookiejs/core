import { Type } from "../../core/type.ts"
import { Utils } from "../../utils/util.ts"

export const number: Type = Type.create({
	key: "number",
	alias: ["number"],
	validate: function (value: unknown): boolean {
		return Utils.isNumber(value)
	},
	example: 1,
	queryController: {
		equals: {
			key: "number",
		},
		notEquals: {
			key: "number",
		},

		gte: { key: "number" },
		gt: { key: "number" },
		lte: { key: "number" },
		lt: { key: "number" },
		in: {
			key: "number",
			isArray: true,
		},
		notIn: {
			key: "number",
			isArray: true,
		},
		isNull: {
			key: "boolean",
		},
	},
}) as Type
