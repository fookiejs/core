import { Field } from "../field/field.ts"
import type { SchemaType } from "../model/schema.ts"
import type { Model } from "../model/model.ts"

export class Utils {
	static has(obj: any, key: string): boolean {
		return Object.hasOwn(obj, key)
	}
	static keys<T extends object>(obj: T): Array<keyof T> {
		return Object.keys(obj) as Array<keyof T>
	}
	static entries<T extends Model>(obj: SchemaType<T>): [keyof T, Field][] {
		return Object.entries(obj) as [keyof T, Field][]
	}
	static isString(value: any): boolean {
		return typeof value === "string"
	}
	static isNumber(value: any): boolean {
		return typeof value === "number" && !isNaN(value)
	}
	static isBoolean(value: any): boolean {
		return typeof value === "boolean"
	}
	static isInteger(value: any): boolean {
		return Number.isInteger(value)
	}
	static isBigInt(value: any): boolean {
		try {
			BigInt(value)
			return true
		} catch {
			return false
		}
	}
	static isDecimal(value: any): boolean {
		if (typeof value !== "string") return false
		return /^-?\d*\.?\d+$/.test(value)
	}
	static isFloat(value: any): boolean {
		return typeof value === "number"
	}
	static isObject(value: any): boolean {
		return typeof value === "object" && value !== null && !Array.isArray(value)
	}
	static isArray(value: unknown): boolean {
		return Array.isArray(value)
	}
	static isArrayOf(value: unknown, validator: (item: unknown) => boolean): boolean {
		return Array.isArray(value) && value.every(validator)
	}
	static isDate(value: any): boolean {
		const date = new Date(value)
		return date instanceof Date && !isNaN(date.getTime())
	}
	static isTimestamp(value: any): boolean {
		if (value instanceof Date) return true

		if (typeof value === "number" && value > 0 && value < 8640000000000000) return true

		if (typeof value === "string") {
			const date = new Date(value)
			return !isNaN(date.getTime())
		}

		return false
	}
	static isPoint(value: any): boolean {
		return (
			this.isObject(value) &&
			typeof value.x === "number" &&
			typeof value.y === "number"
		)
	}
	static isUUID(value: any): boolean {
		if (typeof value !== "string") return false
		return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
	}
	static isGeometry(value: any): boolean {
		return typeof value === "string" && /^([A-Z]+)\s*\([\d\s.,-]+\)$/i.test(value)
	}
	static isGeography(value: any): boolean {
		return this.isGeometry(value)
	}
	static isMoney(value: any): boolean {
		return typeof value === "string" && /^-?\d+(\.\d{1,2})?$/.test(value)
	}
	static isTime(value: any): boolean {
		return typeof value === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(value)
	}
	static isDateTime(value: any): boolean {
		if (typeof value !== "string") return false
		const date = new Date(value)
		return date instanceof Date && !isNaN(date.getTime()) && value.includes("T")
	}
	static isDuration(value: any): boolean {
		if (typeof value !== "string") return false
		return /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/.test(value)
	}
	static isGeoPoint(value: any): boolean {
		return (
			this.isObject(value) &&
			typeof value.latitude === "number" &&
			typeof value.longitude === "number" &&
			value.latitude >= -90 && value.latitude <= 90 &&
			value.longitude >= -180 && value.longitude <= 180
		)
	}
	static isGeoShape(value: any): boolean {
		if (!this.isObject(value) || typeof value.type !== "string" || !Array.isArray(value.coordinates)) {
			return false
		}

		const validTypes = ["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon"]
		if (!validTypes.includes(value.type)) {
			return false
		}

		const isValidCoordinate = (coord: any) => {
			return Array.isArray(coord) && coord.length >= 2 &&
				typeof coord[0] === "number" && typeof coord[1] === "number" &&
				coord[0] >= -180 && coord[0] <= 180 && coord[1] >= -90 && coord[1] <= 90
		}

		const isValidCoordinates = (coords: any[]): boolean => {
			if (value.type === "Point") return isValidCoordinate(coords)
			if (value.type === "LineString") return coords.every(isValidCoordinate)
			if (value.type === "Polygon") return coords.every((ring) => ring.every(isValidCoordinate))
			if (value.type === "MultiPoint") return coords.every(isValidCoordinate)
			if (value.type === "MultiLineString") return coords.every((line) => line.every(isValidCoordinate))
			if (value.type === "MultiPolygon") {
				return coords.every((poly) => poly.every((ring) => ring.every(isValidCoordinate)))
			}
			return false
		}

		return isValidCoordinates(value.coordinates)
	}
	static includes(target: any[] | string, value: any): boolean {
		return target.includes(value)
	}
}
