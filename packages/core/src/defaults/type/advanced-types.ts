import { Type } from "../../type/type.ts"
import { Utils } from "../../utils/util.ts"

export const advancedTypes = {
	uuid: Type.create({
		key: "uuid",
		validate: Utils.isUUID,
		example: "550e8400-e29b-41d4-a716-446655440000",
		queryController: {
			equals: { key: "uuid" },
			notEquals: { key: "uuid" },
			in: { key: "uuid", isArray: true },
			notIn: { key: "uuid", isArray: true },
			isNull: { key: "boolean" },
		},
		alias: ["uuid"],
	}),

	bigint: Type.create({
		key: "bigint",
		validate: Utils.isBigInt,
		example: "9007199254740991",
		queryController: {
			equals: { key: "bigint" },
			notEquals: { key: "bigint" },
			gt: { key: "bigint" },
			gte: { key: "bigint" },
			lt: { key: "bigint" },
			lte: { key: "bigint" },
			in: { key: "bigint", isArray: true },
			notIn: { key: "bigint", isArray: true },
			isNull: { key: "boolean" },
		},
		alias: ["bigint", "int8"],
	}),

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
	}),

	jsonb: Type.create({
		key: "json",
		validate: Utils.isObject,
		example: "object",
		queryController: {
			isNull: { key: "boolean" },
		},
		alias: ["jsonb"],
	}),

	timestamp: Type.create({
		key: "timestamp",
		validate: Utils.isDate,
		example: "2024-03-22T12:00:00Z",
		queryController: {
			equals: { key: "timestamp" },
			notEquals: { key: "timestamp" },
			lt: { key: "timestamp" },
			lte: { key: "timestamp" },
			gt: { key: "timestamp" },
			gte: { key: "timestamp" },
			in: { key: "timestamp", isArray: true },
			notIn: { key: "timestamp", isArray: true },
			isNull: { key: "boolean" },
		},
		alias: ["timestamp", "timestamp without time zone", "DateTime"],
	}),

	timestamptz: Type.create({
		key: "timestamptz",
		validate: Utils.isDate,
		example: "2024-03-22T12:00:00+03:00",
		queryController: {
			equals: { key: "timestamptz" },
			notEquals: { key: "timestamptz" },
			lt: { key: "timestamptz" },
			lte: { key: "timestamptz" },
			gt: { key: "timestamptz" },
			gte: { key: "timestamptz" },
			in: { key: "timestamptz", isArray: true },
			notIn: { key: "timestamptz", isArray: true },
			isNull: { key: "boolean" },
		},
		alias: ["timestamptz", "timestamp with time zone", "DateTime"],
	}),
}
