import { Type } from "../../core/type.ts"
import { Utils } from "../../utils/util.ts"

export const types = {
	enum: <T extends Record<string, string>>(enumObj: T): Type => {
		const enumValues = Object.values(enumObj)
		return Type.create({
			key: "enum",
			validate: (value: any) => enumValues.includes(value),
			example: enumValues[0],
			queryController: {
				equals: { key: "text" },
				notEquals: { key: "text" },
				in: { key: "text", isArray: true },
				notIn: { key: "text", isArray: true },
				isNull: { key: "boolean" },
			},
			alias: ["enum"],
		})
	},
	array: (innerType: Type): Type => {
		return Type.create({
			key: `${innerType.key}[]`,

			validate: (value: any) => Array.isArray(value) && value.every(innerType.validate),
			example: [innerType.example],
			queryController: {},
			alias: ["array"],
		})
	},
	varchar: (maxLength: number): Type => {
		return Type.create({
			key: `varchar(${maxLength})`,
			validate: (value: unknown): boolean => {
				if (typeof value !== "string") return false
				return value.length <= maxLength
			},
			example: `example varchar`.substring(0, Math.min(15, maxLength)),
			queryController: {
				equals: { key: "text" },
				notEquals: { key: "text" },
				like: { key: "text" },
				ilike: { key: "text" },
				in: { key: "text", isArray: true },
				notIn: { key: "text", isArray: true },
				isNull: { key: "boolean" },
			},
			alias: ["varchar", "character varying"],
		})
	},
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
	}) as Type,

	integer: Type.create({
		key: "integer",
		validate: Utils.isInteger,
		example: 42,
		queryController: {
			equals: { key: "integer" },
			notEquals: { key: "integer" },
			gt: { key: "integer" },
			gte: { key: "integer" },
			lt: { key: "integer" },
			lte: { key: "integer" },
			in: { key: "integer", isArray: true },
			notIn: { key: "integer", isArray: true },
			isNull: { key: "boolean" },
		},
		alias: ["int", "int4", "integer"],
	}) as Type,

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
	}) as Type,

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

	float: Type.create({
		key: "float",
		validate: Utils.isFloat,
		example: 1.23,
		queryController: {
			equals: { key: "float" },
			notEquals: { key: "float" },
			gt: { key: "float" },
			gte: { key: "float" },
			lt: { key: "float" },
			lte: { key: "float" },
			in: { key: "float", isArray: true },
			notIn: { key: "float", isArray: true },
			isNull: { key: "boolean" },
		},
		alias: ["float", "float8", "double precision"],
	}) as Type,

	text: Type.create({
		key: "text",
		validate: Utils.isString,
		example: "example text",
		queryController: {
			equals: { key: "text" },
			notEquals: { key: "text" },
			like: { key: "text" },
			ilike: { key: "text" },
			in: { key: "text", isArray: true },
			notIn: { key: "text", isArray: true },
			isNull: { key: "boolean" },
		},
		alias: ["text"],
	}) as Type,

	jsonb: Type.create({
		key: "jsonb",
		validate: Utils.isObject,
		example: { example: "jsonb" },
		queryController: {
			equals: { key: "jsonb" },
			notEquals: { key: "jsonb" },
			isNull: { key: "boolean" },
		},
		alias: ["jsonb"],
	}) as Type,

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
	}) as Type,

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
	}) as Type,

	point: Type.create({
		key: "point",
		validate: Utils.isPoint,
		example: { x: 10.123, y: 20.456 },
		queryController: {
			equals: { key: "point" },
			notEquals: { key: "point" },
			isNull: { key: "boolean" },
		},
		alias: ["point"],
	}) as Type,

	boolean: Type.create({
		key: "boolean",
		validate: Utils.isBoolean,
		example: true,
		queryController: {
			equals: { key: "boolean" },
			notEquals: { key: "boolean" },
			isNull: { key: "boolean" },
		},
		alias: ["boolean", "bool"],
	}) as Type,
}
