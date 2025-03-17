import { Type } from "../../core/type.ts"
import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js"
export const number = Type.create({
	key: "number",
	jsonType: "number",
	validate: function (value: unknown): boolean {
		return lodash.isNumber(value)
	},
	example: 1,
	queryController: {
		equals: {
			key: "number",
			validate: lodash.isNumber,
		},
		notEquals: {
			key: "number",
			validate: lodash.isNumber,
		},

		gte: { key: "number", validate: lodash.isNumber },
		gt: { key: "number", validate: lodash.isNumber },
		lte: { key: "number", validate: lodash.isNumber },
		lt: { key: "number", validate: lodash.isNumber },
		in: {
			key: "number",
			validate: lodash.isNumber,
			isArray: true,
		},
		notIn: {
			key: "number",
			validate: lodash.isNumber,
			isArray: true,
		},
		isNull: {
			key: "boolean",
			validate: lodash.isBoolean,
		},
	},
})
