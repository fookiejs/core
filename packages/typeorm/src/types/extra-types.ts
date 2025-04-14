import { Type } from "@fookiejs/core"
import { Utils } from "@fookiejs/core"

export const types = {
	decimal: Type.create({
		key: "decimal",
		validate: Utils.isDecimal,
		example: "10.25",
		queryController: {
			equals: { key: "decimal" },
			notEquals: { key: "decimal" },
			gt: { key: "decimal" },
			gte: { key: "decimal" },
			lt: { key: "decimal" },
			lte: { key: "decimal" },
			in: { key: "decimal", isArray: true },
			notIn: { key: "decimal", isArray: true },
			isNull: { key: "boolean" },
		},
		alias: ["numeric", "decimal"],
	}) as Type,
}
