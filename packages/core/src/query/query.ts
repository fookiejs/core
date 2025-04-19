import { Model } from "../model/model.ts"
import { TypeStandartization } from "../type/standartization.ts"

type QueryOperatorValue<T extends TypeStandartization> = T extends TypeStandartization.String ? string
	: T extends TypeStandartization.Integer | TypeStandartization.Float | TypeStandartization.Decimal ? number
	: T extends TypeStandartization.BigInt ? string
	: T extends TypeStandartization.Boolean ? boolean
	: T extends TypeStandartization.Date | TypeStandartization.DateTime ? string | Date
	: T extends TypeStandartization.Time ? string
	: T extends TypeStandartization.Timestamp ? number
	: T extends TypeStandartization.Duration ? string
	: T extends TypeStandartization.GeoPoint ? { latitude: number; longitude: number }
	: T extends TypeStandartization.GeoShape ? { type: string; coordinates: number[][] }
	: T extends TypeStandartization.UUID ? string
	: T extends TypeStandartization.JSON ? Record<string, unknown>
	: unknown

type QueryOperators<T extends TypeStandartization> = {
	equals?: QueryOperatorValue<T>
	notEquals?: QueryOperatorValue<T>
	gt?: T extends
		| TypeStandartization.Integer
		| TypeStandartization.Float
		| TypeStandartization.Decimal
		| TypeStandartization.Date
		| TypeStandartization.DateTime
		| TypeStandartization.Time
		| TypeStandartization.Timestamp
		| TypeStandartization.Duration ? QueryOperatorValue<T>
		: never
	gte?: T extends
		| TypeStandartization.Integer
		| TypeStandartization.Float
		| TypeStandartization.Decimal
		| TypeStandartization.Date
		| TypeStandartization.DateTime
		| TypeStandartization.Time
		| TypeStandartization.Timestamp
		| TypeStandartization.Duration ? QueryOperatorValue<T>
		: never
	lt?: T extends
		| TypeStandartization.Integer
		| TypeStandartization.Float
		| TypeStandartization.Decimal
		| TypeStandartization.Date
		| TypeStandartization.DateTime
		| TypeStandartization.Time
		| TypeStandartization.Timestamp
		| TypeStandartization.Duration ? QueryOperatorValue<T>
		: never
	lte?: T extends
		| TypeStandartization.Integer
		| TypeStandartization.Float
		| TypeStandartization.Decimal
		| TypeStandartization.Date
		| TypeStandartization.DateTime
		| TypeStandartization.Time
		| TypeStandartization.Timestamp
		| TypeStandartization.Duration ? QueryOperatorValue<T>
		: never
	in?: T extends
		| TypeStandartization.String
		| TypeStandartization.Integer
		| TypeStandartization.Float
		| TypeStandartization.Decimal
		| TypeStandartization.BigInt
		| TypeStandartization.UUID ? QueryOperatorValue<T>[]
		: never
	notIn?: T extends
		| TypeStandartization.String
		| TypeStandartization.Integer
		| TypeStandartization.Float
		| TypeStandartization.Decimal
		| TypeStandartization.BigInt
		| TypeStandartization.UUID ? QueryOperatorValue<T>[]
		: never
	like?: T extends TypeStandartization.String ? string : never
	notLike?: T extends TypeStandartization.String ? string : never
	isNull?: boolean
}

type ModelFieldType<M, K extends keyof M> = M[K] extends { type: TypeStandartization } ? M[K]["type"]
	: TypeStandartization

export class QueryType<M extends Model> {
	limit?: number
	offset?: number
	orderBy?: {
		[K in Exclude<keyof M, "deletedAt">]?: "asc" | "desc"
	}
	attributes?: string[]
	filter?: {
		[K in Exclude<keyof M, "deletedAt">]?: QueryOperators<ModelFieldType<M, K>>
	}
}
