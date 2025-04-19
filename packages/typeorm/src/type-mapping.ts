import { TypeStandartization } from "../../core/src/type/standartization.ts"

export type TypeOrmTypeResult = {
	type: string
	options?: Record<string, any>
}

export type TypeOrmMappingOptions = {
	enumValues?: string[]
	isArray?: boolean
	enum?: Record<string, string | number>
}

export function mapCoreTypeToTypeOrm(type: TypeStandartization, options?: TypeOrmMappingOptions): TypeOrmTypeResult {
	const mapper = typeOrmTypeMapping[type]
	if (!mapper) {
		throw new Error(`Unsupported Type: ${type}`)
	}
	const result = mapper()

	if (options?.enum && type === TypeStandartization.Enum) {
		result.options = { ...result.options, enum: Object.values(options.enum) }
	}

	if (options?.isArray) {
		result.options = { ...result.options, array: true }
	}

	return result
}

export const typeOrmTypeMapping: Record<TypeStandartization, () => TypeOrmTypeResult> = {
	[TypeStandartization.String]: () => ({
		type: "text",
	}),
	[TypeStandartization.Integer]: () => ({
		type: "integer",
	}),
	[TypeStandartization.Float]: () => ({
		type: "double precision",
	}),
	[TypeStandartization.Decimal]: () => ({
		type: "decimal",
		options: {
			precision: 10,
			scale: 2,
		},
	}),
	[TypeStandartization.BigInt]: () => ({
		type: "bigint",
	}),
	[TypeStandartization.Boolean]: () => ({
		type: "boolean",
	}),
	[TypeStandartization.Enum]: () => ({
		type: "enum",
	}),
	[TypeStandartization.Date]: () => ({
		type: "date",
	}),
	[TypeStandartization.Time]: () => ({
		type: "time",
	}),
	[TypeStandartization.DateTime]: () => ({
		type: "timestamp",
	}),
	[TypeStandartization.Timestamp]: () => ({
		type: "timestamp with time zone",
	}),
	[TypeStandartization.Duration]: () => ({
		type: "interval",
	}),
	[TypeStandartization.GeoPoint]: () => ({
		type: "point",
	}),
	[TypeStandartization.GeoShape]: () => ({
		type: "geometry",
	}),
	[TypeStandartization.UUID]: () => ({
		type: "uuid",
	}),
	[TypeStandartization.Binary]: () => ({
		type: "bytea",
	}),
	[TypeStandartization.JSON]: () => ({
		type: "jsonb",
	}),
}
