export class Utils {
	static has(obj: any, key: string): boolean {
		return Object.hasOwn(obj, key)
	}
	static keys<T extends object>(obj: T): Array<keyof T> {
		return Object.keys(obj) as Array<keyof T>
	}
	static isString(value: unknown): boolean {
		return typeof value === "string"
	}
	static isNumber(value: unknown): boolean {
		return typeof value === "number"
	}
	static isBoolean(value: unknown): boolean {
		return typeof value === "boolean"
	}
}
