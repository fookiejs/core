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

	varchar: Type.create({
		key: "varchar",
		validate: Utils.isString,
		example: "example varchar",
		queryController: {
			equals: { key: "varchar" },
			notEquals: { key: "varchar" },
			like: { key: "varchar" },
			ilike: { key: "varchar" },
			in: { key: "varchar", isArray: true },
			notIn: { key: "varchar", isArray: true },
			isNull: { key: "boolean" },
		},
		alias: ["varchar", "character varying"],
	}) as Type,
}
