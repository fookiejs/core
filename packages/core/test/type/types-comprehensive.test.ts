import { defaults, Field, FookieError, Model } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"
Deno.test("Types - Comprehensive Validation Tests", () => {
	Deno.test("Boolean Type", () => {
		const booleanType = defaults.type.boolean
		expect(booleanType.validate(true)).toBe(true)
		expect(booleanType.validate(false)).toBe(true)
		expect(booleanType.validate("true")).toBe(false)
		expect(booleanType.validate(1)).toBe(false)
		expect(booleanType.validate(null)).toBe(false)
		expect(booleanType.validate(undefined)).toBe(false)
		expect(booleanType.validate({})).toBe(false)
	})
	Deno.test("Integer Type", () => {
		const integerType = defaults.type.integer
		expect(integerType.validate(0)).toBe(true)
		expect(integerType.validate(42)).toBe(true)
		expect(integerType.validate(-100)).toBe(true)
		expect(integerType.validate(3.14)).toBe(false)
		expect(integerType.validate("42")).toBe(false)
		expect(integerType.validate(null)).toBe(false)
		expect(integerType.validate(undefined)).toBe(false)
		expect(integerType.validate({})).toBe(false)
	})
	Deno.test("Float Type", () => {
		const floatType = defaults.type.float
		expect(floatType.validate(0)).toBe(true)
		expect(floatType.validate(3.14)).toBe(true)
		expect(floatType.validate(-2.5)).toBe(true)
		expect(floatType.validate("3.14")).toBe(false)
		expect(floatType.validate(null)).toBe(false)
		expect(floatType.validate(undefined)).toBe(false)
		expect(floatType.validate({})).toBe(false)
	})
	Deno.test("Text Type", () => {
		const textType = defaults.type.text
		expect(textType.validate("")).toBe(true)
		expect(textType.validate("hello world")).toBe(true)
		expect(textType.validate("a".repeat(1000))).toBe(true)
		expect(textType.validate(123)).toBe(false)
		expect(textType.validate(null)).toBe(false)
		expect(textType.validate(undefined)).toBe(false)
		expect(textType.validate({})).toBe(false)
	})
	Deno.test("Date Type", () => {
		const dateType = defaults.type.date
		expect(dateType.validate(new Date())).toBe(true)
		expect(dateType.validate("2023-01-01T12:00:00Z")).toBe(true)
		expect(dateType.validate("2023-01-01")).toBe(true)
		expect(dateType.validate("not-a-date")).toBe(false)
		expect(dateType.validate(123)).toBe(false)
		expect(dateType.validate(null)).toBe(false)
		expect(dateType.validate(undefined)).toBe(false)
		expect(dateType.validate({})).toBe(false)
	})
	Deno.test("Text Type", () => {
		const textType = defaults.type.text
		expect(textType.validate("")).toBe(true)
		expect(textType.validate("hello world")).toBe(true)
		expect(textType.validate("a".repeat(1000))).toBe(true)
		expect(textType.validate(123)).toBe(false)
		expect(textType.validate(null)).toBe(false)
		expect(textType.validate(undefined)).toBe(false)
		expect(textType.validate({})).toBe(false)
	})
	Deno.test("Enum Type", () => {
		enum Status {
			ACTIVE = "ACTIVE",
			INACTIVE = "INACTIVE",
			PENDING = "PENDING",
		}
		const enumType = defaults.type.enum(Status)
		expect(enumType.validate(Status.ACTIVE)).toBe(true)
		expect(enumType.validate(Status.INACTIVE)).toBe(true)
		expect(enumType.validate(Status.PENDING)).toBe(true)
		expect(enumType.validate("OTHER")).toBe(false)
		expect(enumType.validate(123)).toBe(false)
		expect(enumType.validate(null)).toBe(false)
		expect(enumType.validate(undefined)).toBe(false)
		expect(enumType.validate({})).toBe(false)
	})
	Deno.test("Array Type", () => {
		const textArrayType = defaults.type.array(defaults.type.text)
		expect(textArrayType.validate(["one", "two"])).toBe(true)
		expect(textArrayType.validate([])).toBe(true)
		expect(textArrayType.validate(["one", 2])).toBe(false)
		expect(textArrayType.validate("not-an-array")).toBe(false)
		expect(textArrayType.validate(null)).toBe(false)
		expect(textArrayType.validate(undefined)).toBe(false)
		expect(textArrayType.validate({})).toBe(false)
	})
	Deno.test("Varchar Type", () => {
		const varcharType = defaults.type.varchar(50)
		expect(varcharType.validate("short text")).toBe(true)
		expect(varcharType.validate("a".repeat(50))).toBe(true)
		expect(varcharType.validate("a".repeat(51))).toBe(false)
		expect(varcharType.validate(123)).toBe(false)
	})
})
enum UserRole {
	ADMIN = "ADMIN",
	USER = "USER",
	GUEST = "GUEST",
}
@Model.Decorator({
	database: defaults.database.store,
	binds: { create: { role: [] } },
})
class ComplexModel extends Model {
	@Field.Decorator({
		type: defaults.type.text,
		features: [],
	})
	name!: string
	@Field.Decorator({
		type: defaults.type.integer,
		features: [defaults.feature.required],
	})
	age!: number
	@Field.Decorator({
		type: defaults.type.float,
		features: [],
	})
	height?: number
	@Field.Decorator({
		type: defaults.type.boolean,
		features: [defaults.feature.required],
	})
	active!: boolean
	@Field.Decorator({
		type: defaults.type.date,
		features: [defaults.feature.required],
	})
	birthDate!: string
	@Field.Decorator({
		type: defaults.type.enum(UserRole),
		features: [],
	})
	role?: UserRole
	@Field.Decorator({
		type: defaults.type.array(defaults.type.text),
		features: [],
	})
	tags?: string[]
	@Field.Decorator({
		type: defaults.type.varchar(50),
		features: [],
	})
	description?: string
}
Deno.test("Types - Model with Multiple Types", async () => {
	const validModel = await ComplexModel.create({
		name: "John Doe",
		age: 30,
		height: 175.5,
		active: true,
		birthDate: "1993-01-15T00:00:00.000Z",
		role: UserRole.USER,
		tags: ["developer", "typescript"],
		description: "A software developer",
	})
	expect(validModel instanceof ComplexModel).toBe(true)
	expect(validModel.name).toBe("John Doe")
	expect(validModel.age).toBe(30)
	expect(validModel.height).toBe(175.5)
	expect(validModel.active).toBe(true)
	expect(validModel.birthDate).toBe("1993-01-15T00:00:00.000Z")
	expect(validModel.role).toBe(UserRole.USER)
	expect(validModel.tags).toEqual(["developer", "typescript"])
	expect(validModel.description).toBe("A software developer")
	const minimalModel = await ComplexModel.create({
		name: "Jane Smith",
		age: 25,
		active: false,
		birthDate: "1998-05-20T00:00:00.000Z",
	})
	expect(minimalModel instanceof ComplexModel).toBe(true)
	expect(minimalModel.height).toBeUndefined()
	expect(minimalModel.role).toBeUndefined()
	expect(minimalModel.tags).toBeUndefined()
	expect(minimalModel.description).toBeUndefined()
	let error = null
	try {
		await ComplexModel.create({
			name: "Invalid User",
			age: "40",
			active: true,
			birthDate: "invalid-date",
		} as any)
	} catch (e) {
		error = e
	}
	expect(error instanceof FookieError).toBe(true)
	error = null
	try {
		await ComplexModel.create({
			name: "Another Invalid User",
			age: 50,
			active: true,
			birthDate: "not-a-date",
		} as any)
	} catch (e) {
		error = e
	}
	expect(error instanceof FookieError).toBe(true)
	error = null
	try {
		await ComplexModel.create({
			name: "One More Invalid User",
			age: 35,
			active: true,
			birthDate: "2023-01-01T00:00:00.000Z",
			description: "a".repeat(51),
		})
	} catch (e) {
		error = e
	}
	expect(error instanceof FookieError).toBe(true)
})
