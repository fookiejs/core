import { BaseTypeMatcher } from "@fookiejs/core"

export class TypeOrmTypeMatcher extends BaseTypeMatcher {
	constructor() {
		const typeMapping = {
			uuid: "uuid",
			jsonb: "jsonb",
			json: "json",
			decimal: "decimal",
			bigint: "bigint",
			smallint: "smallint",
			array: "simple-array",
			enum: "enum",
			timestamp: "timestamp with time zone",
		}

		const supportedTypes = {
			text: ["text", "string", "varchar", "character varying"],
			integer: ["integer", "int", "int4"],
			float: ["float", "float8", "double precision"],
			boolean: ["boolean", "bool"],
			date: ["date", "timestamp", "datetime", "timestamp with time zone"],
			uuid: ["uuid"],
			jsonb: ["jsonb"],
			json: ["json"],
			decimal: ["decimal", "numeric"],
			bigint: ["bigint", "int8"],
			smallint: ["smallint", "int2"],
			time: ["time", "time without time zone"],
			bytea: ["bytea", "binary"],
			point: ["point"],
			inet: ["inet", "ipv4", "ipv6"],
		}

		super(typeMapping, supportedTypes)
	}
}
