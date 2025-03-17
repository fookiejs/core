import { Type } from "../../core/type.ts"
import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js"
import moment from "moment"

function isDate(value: unknown) {
	if (!lodash.isString(value)) return false
	return moment(value as string, "YYYY-MM-DD", true).isValid()
}

export const date = Type.create({
	key: "date",
	jsonType: "date",
	validate: isDate,
	example: new Date("2023-01-01"),
	queryController: {
		equals: {
			key: "date",
			validate: isDate,
		},
		notEquals: {
			key: "date",
			validate: isDate,
		},
		in: {
			key: "date",
			validate: isDate,
			isArray: true,
		},
		notIn: {
			key: "date",
			validate: isDate,
			isArray: true,
		},
		lt: {
			key: "date",
			validate: isDate,
		},
		lte: {
			key: "date",
			validate: isDate,
		},
		gt: {
			key: "date",
			validate: isDate,
		},
		gte: {
			key: "date",
			validate: isDate,
		},
		isNull: {
			key: "boolean",
			validate: lodash.isBoolean,
		},
	},
})
