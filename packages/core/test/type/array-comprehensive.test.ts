import { defaults, Field, FookieError, Model } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"

// Test array type creation and validation
Deno.test("Array Type - Creation and Validation", () => {
	// Test with different inner types
	const textArrayType = defaults.type.array(defaults.type.text)
	const intArrayType = defaults.type.array(defaults.type.integer)
	const uuidArrayType = defaults.type.array(defaults.type.uuid)
	const boolArrayType = defaults.type.array(defaults.type.boolean)
	const varcharArrayType = defaults.type.array(defaults.type.varchar(10))

	// Check correct type keys
	expect(textArrayType.key).toBe("text[]")
	expect(intArrayType.key).toBe("integer[]")
	expect(uuidArrayType.key).toBe("uuid[]")
	expect(boolArrayType.key).toBe("boolean[]")
	expect(varcharArrayType.key).toBe("varchar(10)[]")

	// Test valid text arrays
	expect(textArrayType.validate(["a".repeat(5), "b".repeat(8)])).toBe(true)
	expect(textArrayType.validate([""])).toBe(true)
	expect(textArrayType.validate([])).toBe(true) // Empty array is valid

	// Test invalid text arrays
	expect(textArrayType.validate([123, "world"])).toBe(false) // Contains non-string
	expect(textArrayType.validate("not an array")).toBe(false) // Not an array
	expect(textArrayType.validate(null)).toBe(false)
	expect(textArrayType.validate(undefined)).toBe(false)

	// Test valid integer arrays
	expect(intArrayType.validate([1, 2, 3])).toBe(true)
	expect(intArrayType.validate([0, -5, 10])).toBe(true)
	expect(intArrayType.validate([])).toBe(true)

	// Test invalid integer arrays
	expect(intArrayType.validate([1, "2", 3])).toBe(false) // Contains non-integer
	expect(intArrayType.validate([1.5, 2, 3])).toBe(false) // Contains float

	// Test valid UUID arrays
	expect(uuidArrayType.validate(["550e8400-e29b-41d4-a716-446655440000"])).toBe(true)
	expect(uuidArrayType.validate([])).toBe(true)

	// Test invalid UUID arrays
	expect(uuidArrayType.validate(["550e8400-e29b-41d4-a716-446655440000", "not-uuid"])).toBe(false)

	// Test valid boolean arrays
	expect(boolArrayType.validate([true, false, true])).toBe(true)
	expect(boolArrayType.validate([])).toBe(true)

	// Test invalid boolean arrays
	expect(boolArrayType.validate([true, "false"])).toBe(false)

	// Test valid varchar arrays (with length constraints)
	expect(varcharArrayType.validate(["a".repeat(5), "b".repeat(8)])).toBe(true) // All under 10 chars
	expect(varcharArrayType.validate([])).toBe(true)

	// Test invalid varchar arrays
	expect(varcharArrayType.validate(["a".repeat(15), "short"])).toBe(false) // First string too long
})

// Test nested array types
Deno.test("Array Type - Nested Arrays", () => {
	// Array of array of text
	const nestedArrayType = defaults.type.array(defaults.type.array(defaults.type.text))

	// Check type key
	expect(nestedArrayType.key).toBe("text[][]")

	// Test valid nested arrays
	expect(nestedArrayType.validate([["a".repeat(5), "b".repeat(5)], ["c".repeat(5), "d".repeat(5)]])).toBe(true)
	expect(nestedArrayType.validate([["single item"]])).toBe(true)
	expect(nestedArrayType.validate([[]])).toBe(true)
	expect(nestedArrayType.validate([])).toBe(true)

	// Test invalid nested arrays
	expect(nestedArrayType.validate([["text"], 123])).toBe(false) // Second item not array
	expect(nestedArrayType.validate([["text"], [123]])).toBe(false) // Contains non-string in inner array
})

// Models with array fields of different types
@Model.Decorator({
	database: defaults.database.store,
	binds: { create: { role: [] } },
})
class StringArrayModel extends Model {
	@Field.Decorator({
		type: defaults.type.array(defaults.type.text),
		features: [defaults.feature.required],
	})
	tags!: string[]
}

@Model.Decorator({
	database: defaults.database.store,
	binds: { create: { role: [] } },
})
class IntArrayModel extends Model {
	@Field.Decorator({
		type: defaults.type.array(defaults.type.integer),
		features: [defaults.feature.required],
	})
	scores!: number[]
}

@Model.Decorator({
	database: defaults.database.store,
	binds: { create: { role: [] } },
})
class MultiArrayModel extends Model {
	@Field.Decorator({
		type: defaults.type.array(defaults.type.text),
		features: [defaults.feature.required],
	})
	categories!: string[]

	@Field.Decorator({
		type: defaults.type.array(defaults.type.integer),
		features: [],
	})
	quantities?: number[]

	@Field.Decorator({
		type: defaults.type.varchar(50),
		features: [defaults.feature.required],
	})
	name!: string
}

// Test models with array fields
Deno.test("Array Type - Model Creation", async () => {
	// Valid string array
	const stringModel = await StringArrayModel.create({
		tags: ["a".repeat(5), "b".repeat(8), "c".repeat(10)],
	})
	expect(stringModel instanceof StringArrayModel).toBe(true)
	expect(stringModel.tags).toEqual(["a".repeat(5), "b".repeat(8), "c".repeat(10)])

	// Empty string array
	const emptyStringModel = await StringArrayModel.create({
		tags: [],
	})
	expect(emptyStringModel instanceof StringArrayModel).toBe(true)
	expect(emptyStringModel.tags).toEqual([])

	// Invalid string array
	try {
		await StringArrayModel.create({
			tags: ["a".repeat(5), 123, "c".repeat(10)] as any,
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}

	// Valid integer array
	const intModel = await IntArrayModel.create({
		scores: [85, 90, 95],
	})
	expect(intModel instanceof IntArrayModel).toBe(true)
	expect(intModel.scores).toEqual([85, 90, 95])

	// Invalid integer array
	try {
		await IntArrayModel.create({
			scores: [85, "90", 95] as any,
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}

	// Model with multiple array fields
	const multiModel = await MultiArrayModel.create({
		categories: ["a".repeat(10), "b".repeat(15)],
		quantities: [10, 20, 30],
		name: "a".repeat(20),
	})
	expect(multiModel instanceof MultiArrayModel).toBe(true)
	expect(multiModel.categories).toEqual(["a".repeat(10), "b".repeat(15)])
	expect(multiModel.quantities).toEqual([10, 20, 30])
	expect(multiModel.name).toBe("a".repeat(20))

	// With optional array field omitted
	const partialModel = await MultiArrayModel.create({
		categories: ["a".repeat(5), "b".repeat(10)],
		name: "a".repeat(15),
	})
	expect(partialModel instanceof MultiArrayModel).toBe(true)
	expect(partialModel.categories).toEqual(["a".repeat(5), "b".repeat(10)])
	expect(partialModel.quantities).toBeUndefined()
})

// Real-world use case with array types
Deno.test("Array Type - Real World Use Case", async () => {
	@Model.Decorator({
		database: defaults.database.store,
		binds: { create: { role: [] } },
	})
	class Product extends Model {
		@Field.Decorator({
			type: defaults.type.varchar(100),
			features: [defaults.feature.required],
		})
		name!: string

		@Field.Decorator({
			type: defaults.type.float,
			features: [defaults.feature.required],
		})
		price!: number

		@Field.Decorator({
			type: defaults.type.array(defaults.type.varchar(30)),
			features: [defaults.feature.required],
		})
		categories!: string[]

		@Field.Decorator({
			type: defaults.type.array(defaults.type.text),
			features: [],
		})
		tags?: string[]

		@Field.Decorator({
			type: defaults.type.array(defaults.type.boolean),
			features: [],
		})
		features?: boolean[]
	}

	// Valid product with all fields
	const product = await Product.create({
		name: "a".repeat(30),
		price: 999.99,
		categories: ["a".repeat(15), "b".repeat(20)],
		tags: ["c".repeat(10), "d".repeat(15), "e".repeat(20), "f".repeat(25)],
		features: [true, false, true, true],
	})

	expect(product instanceof Product).toBe(true)
	expect(product.name).toBe("a".repeat(30))
	expect(product.price).toBe(999.99)
	expect(product.categories).toEqual(["a".repeat(15), "b".repeat(20)])
	expect(product.tags).toEqual(["c".repeat(10), "d".repeat(15), "e".repeat(20), "f".repeat(25)])
	expect(product.features).toEqual([true, false, true, true])

	// Test category length validation
	try {
		await Product.create({
			name: "a".repeat(30),
			price: 499.99,
			categories: ["a".repeat(50)], // Too long for varchar(30)
			tags: ["tag1", "tag2"],
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}
})
