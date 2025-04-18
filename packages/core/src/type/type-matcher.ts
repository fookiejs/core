import { Type } from "./type.ts"

export interface TypeMatcherResult {
	type: string
	isEnum: boolean
	enumValues?: string[]
	arrayType?: string
}

export interface TypeMatcher {
	match(type: Type): TypeMatcherResult
}

export class BaseTypeMatcher implements TypeMatcher {
	protected typeMapping: Record<string, string>
	protected supportedTypes: Record<string, string[]>

	constructor(
		typeMapping: Record<string, string> = {},
		supportedTypes: Record<string, string[]> = {},
	) {
		this.typeMapping = typeMapping
		this.supportedTypes = supportedTypes
	}

	match(type: Type): TypeMatcherResult {
		if (type.key.includes("[]")) {
			const baseType = type.key.replace("[]", "")
			const matchedType = this.matchBaseType(baseType)
			return { type: "array", isEnum: false, arrayType: matchedType.type }
		}

		if (type.key.startsWith("enum(") || type.key === "enum") {
			return {
				type: "enum",
				isEnum: true,
				enumValues: type.example ? Object.values(type.example) : [],
			}
		}

		if (type.alias?.includes("date") || type.alias?.includes("timestamp")) {
			return { type: "timestamp", isEnum: false }
		}

		return this.matchBaseType(type.key)
	}

	protected matchBaseType(typeKey: string): TypeMatcherResult {
		for (const [baseType, aliases] of Object.entries(this.supportedTypes)) {
			if (typeKey === baseType || (Array.isArray(aliases) && aliases.includes(typeKey))) {
				return { type: this.typeMapping[baseType] || baseType, isEnum: false }
			}
		}

		if (this.typeMapping[typeKey]) {
			return { type: this.typeMapping[typeKey], isEnum: false }
		}

		throw new Error(
			`Type "${typeKey}" is not supported. Supported types: ${Object.keys(this.typeMapping).join(", ")}`,
		)
	}

	addTypeMapping(key: string, value: string) {
		this.typeMapping[key] = value
	}

	addSupportedType(type: string, aliases: string[]) {
		this.supportedTypes[type] = aliases
	}
}
