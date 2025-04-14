import { Type } from "../../type/type.ts"
import { Utils } from "../../utils/util.ts"

export const nativeTypes = {
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
	}),

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
	}),

	text: Type.create({
		key: "text",
		validate: Utils.isString,
		example: "example text",
		queryController: {
			equals: { key: "text" },
			notEquals: { key: "text" },
			like: { key: "text" },
			in: { key: "text", isArray: true },
			notIn: { key: "text", isArray: true },
			isNull: { key: "boolean" },
		},
		alias: ["text"],
	}),

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
	}),
}
