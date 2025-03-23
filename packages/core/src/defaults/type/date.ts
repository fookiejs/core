import { Type } from "../../core/type.ts"

import moment from "moment"
import { Utils } from "../../utils/util.ts"

function isDate(value: unknown) {
	if (!Utils.isString(value)) return false
	return moment(value as string, "YYYY-MM-DD", true).isValid()
}

export const date: Type = Type.create({
	key: "date",
	alias: ["date"],
	validate: isDate,
	example: new Date("2023-01-01"),
	queryController: {
		equals: {
			key: "date",
		},
		notEquals: {
			key: "date",
		},
		in: {
			key: "date",
			isArray: true,
		},
		notIn: {
			key: "date",
			isArray: true,
		},
		lt: {
			key: "date",
		},
		lte: {
			key: "date",
		},
		gt: {
			key: "date",
		},
		gte: {
			key: "date",
		},
		isNull: {
			key: "boolean",
		},
	},
}) as Type
