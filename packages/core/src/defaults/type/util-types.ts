import { Type } from "../../type/type.ts"

export const utilTypes = {
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
			queryController: {
				isNull: { key: "boolean" },
			},
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
			example: `a`.substring(0, Math.min(15, maxLength)),
			queryController: {
				equals: { key: "text" },
				notEquals: { key: "text" },
				like: { key: "text" },
				in: { key: "text", isArray: true },
				notIn: { key: "text", isArray: true },
				isNull: { key: "boolean" },
			},
			alias: ["varchar", "character varying"],
		})
	},
}
