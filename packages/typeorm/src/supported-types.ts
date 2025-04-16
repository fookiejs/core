export const supportedTypes = {
	text: ["text", "string", "varchar", "character varying"],
	integer: ["integer", "int", "int4"],
	bigint: ["bigint", "int8"],
	decimal: ["decimal", "numeric"],
	float: ["float", "float8", "double precision"],
	boolean: ["boolean", "bool"],
	json: ["json", "jsonb"],
	timestamp: ["timestamp", "timestamp without time zone", "datetime"],
	timestamptz: ["timestamptz", "timestamp with time zone"],
	uuid: ["uuid"],
	enum: ["enum"],
}
