import { Type } from "./type.ts"
import { TypeStandartization } from "./standartization.ts"
import { Utils } from "../utils/util.ts"

type CoreTypesType = Record<TypeStandartization, Type>

export const CoreTypes: CoreTypesType = {
	[TypeStandartization.String]: Type.create({
		queryController: {
			equals: { key: "string" },
			notEquals: { key: "string" },
			like: { key: "string" },
			in: { key: "string", isArray: true },
			notIn: { key: "string", isArray: true },
		},
		validate: Utils.isString,
		example: "example text",
		type: TypeStandartization.String,
	}),
	[TypeStandartization.Integer]: Type.create({
		queryController: {
			equals: { key: "number" },
			notEquals: { key: "number" },
			in: { key: "number", isArray: true },
			notIn: { key: "number", isArray: true },
			gt: { key: "number" },
			gte: { key: "number" },
			lt: { key: "number" },
			lte: { key: "number" },
		},
		validate: Utils.isInteger,
		example: 42,
		type: TypeStandartization.Integer,
	}),
	[TypeStandartization.Float]: Type.create({
		queryController: {
			equals: { key: "number" },
			notEquals: { key: "number" },
			in: { key: "number", isArray: true },
			notIn: { key: "number", isArray: true },
			gt: { key: "number" },
			gte: { key: "number" },
			lt: { key: "number" },
			lte: { key: "number" },
		},
		validate: Utils.isFloat,
		example: 3.14,
		type: TypeStandartization.Float,
	}),
	[TypeStandartization.Decimal]: Type.create({
		queryController: {
			equals: { key: "string" },
			notEquals: { key: "string" },
			in: { key: "string", isArray: true },
			notIn: { key: "string", isArray: true },
			gt: { key: "string" },
			gte: { key: "string" },
			lt: { key: "string" },
			lte: { key: "string" },
		},
		validate: Utils.isDecimal,
		example: "123.45",
		type: TypeStandartization.Decimal,
	}),
	[TypeStandartization.BigInt]: Type.create({
		queryController: {
			equals: { key: "string" },
			notEquals: { key: "string" },
			in: { key: "string", isArray: true },
			notIn: { key: "string", isArray: true },
			gt: { key: "string" },
			gte: { key: "string" },
			lt: { key: "string" },
			lte: { key: "string" },
		},
		validate: Utils.isBigInt,
		example: "9007199254740991",
		type: TypeStandartization.BigInt,
	}),
	[TypeStandartization.Boolean]: Type.create({
		queryController: {
			equals: { key: "boolean" },
			notEquals: { key: "boolean" },
		},
		validate: Utils.isBoolean,
		example: true,
		type: TypeStandartization.Boolean,
	}),
	[TypeStandartization.Enum]: Type.create({
		type: TypeStandartization.Enum,
		validate: Utils.isString,
		queryController: {
			equals: { key: "text" },
			notEquals: { key: "text" },
			in: { key: "text", isArray: true },
			notIn: { key: "text", isArray: true },
			isNull: { key: "boolean" },
		},
	}),
	[TypeStandartization.Date]: Type.create({
		queryController: {
			equals: { key: "date" },
			notEquals: { key: "date" },
			gt: { key: "date" },
			gte: { key: "date" },
			lt: { key: "date" },
			lte: { key: "date" },
		},
		validate: Utils.isDate,
		example: new Date().toISOString(),
		type: TypeStandartization.Date,
	}),
	[TypeStandartization.Time]: Type.create({
		queryController: {
			equals: { key: "time" },
			notEquals: { key: "time" },
			gt: { key: "time" },
			gte: { key: "time" },
			lt: { key: "time" },
			lte: { key: "time" },
		},
		validate: Utils.isTime,
		example: "13:45:30",
		type: TypeStandartization.Time,
	}),
	[TypeStandartization.DateTime]: Type.create({
		queryController: {
			equals: { key: "datetime" },
			notEquals: { key: "datetime" },
			gt: { key: "datetime" },
			gte: { key: "datetime" },
			lt: { key: "datetime" },
			lte: { key: "datetime" },
		},
		validate: Utils.isDateTime,
		example: new Date().toISOString(),
		type: TypeStandartization.DateTime,
	}),
	[TypeStandartization.Timestamp]: Type.create({
		queryController: {
			equals: { key: "timestamp" },
			notEquals: { key: "timestamp" },
			gt: { key: "timestamp" },
			gte: { key: "timestamp" },
			lt: { key: "timestamp" },
			lte: { key: "timestamp" },
		},
		validate: Utils.isTimestamp,
		example: Date.now(),
		type: TypeStandartization.Timestamp,
	}),
	[TypeStandartization.Duration]: Type.create({
		queryController: {
			equals: { key: "duration" },
			notEquals: { key: "duration" },
			gt: { key: "duration" },
			gte: { key: "duration" },
			lt: { key: "duration" },
			lte: { key: "duration" },
		},
		validate: Utils.isDuration,
		example: "PT1H30M",
		type: TypeStandartization.Duration,
	}),
	[TypeStandartization.GeoPoint]: Type.create({
		queryController: {
			equals: { key: "geopoint" },
			notEquals: { key: "geopoint" },
		},
		validate: Utils.isGeoPoint,
		example: { latitude: 40.7128, longitude: -74.0060 },
		type: TypeStandartization.GeoPoint,
	}),
	[TypeStandartization.GeoShape]: Type.create({
		queryController: {
			equals: { key: "geoshape" },
			notEquals: { key: "geoshape" },
		},
		validate: Utils.isGeoShape,
		example: {
			type: "Polygon",
			coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
		},
		type: TypeStandartization.GeoShape,
	}),
	[TypeStandartization.UUID]: Type.create({
		queryController: {
			equals: { key: "string" },
			notEquals: { key: "string" },
			in: { key: "string", isArray: true },
			notIn: { key: "string", isArray: true },
		},
		validate: Utils.isUUID,
		example: "123e4567-e89b-12d3-a456-426614174000",
		type: TypeStandartization.UUID,
	}),
	[TypeStandartization.Binary]: new Type(),
	[TypeStandartization.JSON]: Type.create({
		queryController: {},
		validate: Utils.isObject,
		example: { key: "value" },
		type: TypeStandartization.JSON,
	}),
}
