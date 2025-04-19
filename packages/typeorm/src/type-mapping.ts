import { TypeStandartization } from "@fookiejs/core"
import { ColumnType } from "typeorm"

export function mapCoreTypeToTypeOrm(type: TypeStandartization): ColumnType | "relation" {
	switch (type) {
		case TypeStandartization.String:
			return "varchar"
		case TypeStandartization.Integer:
			return "int"
		case TypeStandartization.Float:
			return "float"
		case TypeStandartization.Decimal:
			return "decimal"
		case TypeStandartization.BigInt:
			return "bigint"
		case TypeStandartization.Boolean:
			return "boolean"
		case TypeStandartization.Enum:
			return "enum"
		case TypeStandartization.Date:
			return "date"
		case TypeStandartization.Time:
			return "time"
		case TypeStandartization.DateTime:
			return "datetime"
		case TypeStandartization.Timestamp:
			return "timestamp"
		case TypeStandartization.Duration:
			return "interval"
		case TypeStandartization.GeoPoint:
			return "point"
		case TypeStandartization.GeoShape:
			return "geometry"
		case TypeStandartization.UUID:
			return "uuid"
		case TypeStandartization.Binary:
			return "bytea"
		case TypeStandartization.JSON:
			return "jsonb"
		default:
			return "relation"
	}
}
