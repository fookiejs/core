import { defaults, Field, FookieError, Model, TypeStandartization } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"
import { CoreTypes } from "../../src/defaults/type/types.ts"

Deno.test("Types - Comprehensive Validation Tests", () => {
	Deno.test("Boolean Type", () => {
		const booleanType = CoreTypes[TypeStandartization.Boolean]
		expect(booleanType.validate(true)).toBe(true)
		expect(booleanType.validate(false)).toBe(true)
		expect(booleanType.validate("true")).toBe(false)
		expect(booleanType.validate(1)).toBe(false)
		expect(booleanType.validate(null)).toBe(false)
		expect(booleanType.validate(undefined)).toBe(false)
		expect(booleanType.validate({})).toBe(false)
	})
	Deno.test("Integer Type", () => {
		const integerType = CoreTypes[TypeStandartization.Integer]
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
		const floatType = CoreTypes[TypeStandartization.Float]
		expect(floatType.validate(0)).toBe(true)
		expect(floatType.validate(3.14)).toBe(true)
		expect(floatType.validate(-2.5)).toBe(true)
		expect(floatType.validate("3.14")).toBe(false)
		expect(floatType.validate(null)).toBe(false)
		expect(floatType.validate(undefined)).toBe(false)
		expect(floatType.validate({})).toBe(false)
	})
	Deno.test("Text Type", () => {
		const textType = CoreTypes[TypeStandartization.String]
		expect(textType.validate("")).toBe(true)
		expect(textType.validate("hello world")).toBe(true)
		expect(textType.validate("a".repeat(1000))).toBe(true)
		expect(textType.validate(123)).toBe(false)
		expect(textType.validate(null)).toBe(false)
		expect(textType.validate(undefined)).toBe(false)
		expect(textType.validate({})).toBe(false)
	})
	Deno.test("Date Type", () => {
		const dateType = CoreTypes[TypeStandartization.Date]
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
		const textType = CoreTypes[TypeStandartization.String]
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
		const enumType = CoreTypes[TypeStandartization.Enum]
		expect(enumType.validate(Status.ACTIVE)).toBe(true)
		expect(enumType.validate(Status.INACTIVE)).toBe(true)
		expect(enumType.validate(Status.PENDING)).toBe(true)
		expect(enumType.validate("OTHER")).toBe(false)
		expect(enumType.validate(123)).toBe(false)
		expect(enumType.validate(null)).toBe(false)
		expect(enumType.validate(undefined)).toBe(false)
		expect(enumType.validate({})).toBe(false)
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
		type: TypeStandartization.String,
		features: [],
	})
	name!: string
	@Field.Decorator({
		type: TypeStandartization.Integer,
		features: [defaults.feature.required],
	})
	age!: number
	@Field.Decorator({
		type: TypeStandartization.Float,
		features: [],
	})
	height?: number
	@Field.Decorator({
		type: TypeStandartization.Boolean,
		features: [defaults.feature.required],
	})
	active!: boolean
	@Field.Decorator({
		type: TypeStandartization.Date,
		features: [defaults.feature.required],
	})
	birthDate!: string
	@Field.Decorator({
		type: TypeStandartization.Enum,
		enum: UserRole,
		features: [],
	})
	role?: UserRole
}
Deno.test("Types - Model with Multiple Types", async () => {
	const validModel = await ComplexModel.create({
		name: "John Doe",
		age: 30,
		height: 175.5,
		active: true,
		birthDate: "1993-01-15T00:00:00.000Z",
		role: UserRole.USER,
	})
	expect(validModel instanceof ComplexModel).toBe(true)
	expect(validModel.name).toBe("John Doe")
	expect(validModel.age).toBe(30)
	expect(validModel.height).toBe(175.5)
	expect(validModel.active).toBe(true)
	expect(validModel.birthDate).toBe("1993-01-15T00:00:00.000Z")
	expect(validModel.role).toBe(UserRole.USER)

	const minimalModel = await ComplexModel.create({
		name: "Jane Smith",
		age: 25,
		active: true,
		birthDate: "1998-06-20T00:00:00.000Z",
	})
	expect(minimalModel instanceof ComplexModel).toBe(true)
	expect(minimalModel.name).toBe("Jane Smith")
	expect(minimalModel.age).toBe(25)
	expect(minimalModel.active).toBe(true)
	expect(minimalModel.birthDate).toBe("1998-06-20T00:00:00.000Z")
	expect(minimalModel.height).toBeUndefined()
	expect(minimalModel.role).toBeUndefined()

	let error = null
	try {
		await ComplexModel.create({
			name: "Invalid Model",
			age: "40" as any,
			active: true,
			birthDate: "1990-01-01T00:00:00.000Z",
		})
	} catch (e) {
		error = e
	}
	expect(error instanceof FookieError).toBe(true)
})
