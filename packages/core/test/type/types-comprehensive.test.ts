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

	Deno.test("Decimal Type", () => {
		const decimalType = defaults.type.decimal

		expect(decimalType.validate("0")).toBe(true)
		expect(decimalType.validate("3.14")).toBe(true)
		expect(decimalType.validate("-2.5")).toBe(true)
		expect(decimalType.validate("100.00")).toBe(true)

		expect(decimalType.validate(3.14)).toBe(false)
		expect(decimalType.validate("abc")).toBe(false)
		expect(decimalType.validate(null)).toBe(false)
		expect(decimalType.validate(undefined)).toBe(false)
		expect(decimalType.validate({})).toBe(false)
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

	Deno.test("UUID Type", () => {
		const uuidType = defaults.type.uuid

		expect(uuidType.validate("550e8400-e29b-41d4-a716-446655440000")).toBe(true)

		expect(uuidType.validate("not-a-uuid")).toBe(false)
		expect(uuidType.validate("550e8400e29b41d4a716446655440000")).toBe(false)
		expect(uuidType.validate(123)).toBe(false)
		expect(uuidType.validate(null)).toBe(false)
		expect(uuidType.validate(undefined)).toBe(false)
		expect(uuidType.validate({})).toBe(false)
	})

	Deno.test("Timestamp Type", () => {
		const timestampType = defaults.type.timestamp

		expect(timestampType.validate("2023-01-01T12:00:00Z")).toBe(true)
		expect(timestampType.validate("2023-01-01")).toBe(true)
		expect(timestampType.validate(new Date())).toBe(true)

		expect(timestampType.validate("not-a-date")).toBe(false)
		expect(timestampType.validate("01/01/2023")).toBe(false)
		expect(timestampType.validate(123)).toBe(false)
		expect(timestampType.validate(null)).toBe(false)
		expect(timestampType.validate(undefined)).toBe(false)
		expect(timestampType.validate({})).toBe(false)
	})

	Deno.test("JSONB Type", () => {
		const jsonbType = defaults.type.jsonb

		expect(jsonbType.validate({})).toBe(true)
		expect(jsonbType.validate({ name: "test" })).toBe(true)
		expect(jsonbType.validate({ nested: { value: 42 } })).toBe(true)

		expect(jsonbType.validate("{}")).toBe(false)
		expect(jsonbType.validate([])).toBe(false)
		expect(jsonbType.validate(42)).toBe(false)
		expect(jsonbType.validate(null)).toBe(false)
		expect(jsonbType.validate(undefined)).toBe(false)
	})

	Deno.test("Point Type", () => {
		const pointType = defaults.type.point

		expect(pointType.validate({ x: 10, y: 20 })).toBe(true)
		expect(pointType.validate({ x: -5.5, y: 3.14 })).toBe(true)

		expect(pointType.validate({ x: "10", y: 20 })).toBe(false)
		expect(pointType.validate({ x: 10 })).toBe(false)
		expect(pointType.validate("POINT(10 20)")).toBe(false)
		expect(pointType.validate(null)).toBe(false)
		expect(pointType.validate(undefined)).toBe(false)
		expect(pointType.validate({})).toBe(false)
	})
})

@Model.Decorator({
	database: defaults.database.store,
	binds: { create: { role: [] } },
})
class ComplexModel extends Model {
	@Field.Decorator({
		type: defaults.type.uuid,
		features: [],
	})
	recordId!: string

	@Field.Decorator({
		type: defaults.type.varchar(50),
		features: [defaults.feature.required],
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
		type: defaults.type.timestamp,
		features: [defaults.feature.required],
	})
	date!: string

	@Field.Decorator({
		type: defaults.type.jsonb,
		features: [],
	})
	metadata?: Record<string, unknown>
}

Deno.test("Types - Model with Multiple Types", async () => {
	const validModel = await ComplexModel.create({
		recordId: "550e8400-e29b-41d4-a716-446655440000",
		name: "a".repeat(20),
		age: 30,
		height: 175.5,
		active: true,
		date: "2023-01-01T12:00:00Z",
		metadata: {
			interests: ["coding", "reading"],
			description: "a".repeat(100),
			location: { city: "New York" },
		},
	})

	expect(validModel instanceof ComplexModel).toBe(true)
	expect(validModel.recordId).toBe("550e8400-e29b-41d4-a716-446655440000")
	expect(validModel.name).toBe("a".repeat(20))
	expect(validModel.age).toBe(30)
	expect(validModel.height).toBe(175.5)
	expect(validModel.active).toBe(true)
	expect(validModel.date).toBe("2023-01-01T12:00:00Z")
	expect(validModel.metadata).toEqual({
		interests: ["coding", "reading"],
		description: "a".repeat(100),
		location: { city: "New York" },
	})

	const minimalModel = await ComplexModel.create({
		recordId: "550e8400-e29b-41d4-a716-446655440000",
		name: "a".repeat(5),
		age: 25,
		active: false,
		date: "2023-02-15T10:30:00Z",
	})

	expect(minimalModel instanceof ComplexModel).toBe(true)
	expect(minimalModel.height).toBeUndefined()
	expect(minimalModel.metadata).toBeUndefined()

	try {
		await ComplexModel.create({
			recordId: "not-a-uuid",
			name: "a".repeat(10),
			age: 40,
			active: true,
			date: "2023-03-20T15:45:00Z",
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}

	try {
		await ComplexModel.create({
			recordId: "550e8400-e29b-41d4-a716-446655440000",
			name: "a".repeat(15),
			age: "40",
			active: true,
			date: "2023-03-20T15:45:00Z",
		} as any)
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}

	try {
		await ComplexModel.create({
			recordId: "550e8400-e29b-41d4-a716-446655440000",
			name: "a".repeat(51),
			age: 40,
			active: true,
			date: "2023-03-20T15:45:00Z",
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}
})
