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
	static includes(target: any[] | string, value: any): boolean {
		return target.includes(value)
	}
}
