import { Type } from "../../core/type.ts"

import moment from "moment"
import { Utils } from "@fookiejs/core/src/utils/util.ts"

function isDate(value: unknown) {
	if (!Utils.isString(value)) return false
	return moment(value as string, "YYYY-MM-DD", true).isValid()
}

export const date: Type = Type.create({
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
			validate: Utils.isBoolean,
		},
	},
}) as Type
