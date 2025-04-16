import { Type } from "@fookiejs/core"
import { supportedTypes } from "./supported-types.ts"

export function matchTypeOrmType(type: Type): { type: string; isEnum?: boolean; enumValues?: string[] } {
	if (type.key.startsWith("enum(") || type.key === "enum") {
		return {
			type: "varchar",
			isEnum: false,
		}
	}

	const typeKey = type.key.toLowerCase()
	const typeAliases = type.alias?.map((a) => a.toLowerCase()) || []

	for (const [ormType, aliases] of Object.entries(supportedTypes)) {
		if (aliases.includes(typeKey) || aliases.some((a) => typeAliases.includes(a))) {
			return { type: ormType }
		}
	}

	throw new Error(
		`Type '${type.key}' is not supported in TypeORM. Supported types are: ${Object.keys(supportedTypes).join(", ")}`,
	)
}
