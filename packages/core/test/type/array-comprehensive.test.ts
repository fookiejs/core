import { defaults, Field, FookieError, Model } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"
Deno.test("Array Type - Creation and Validation", () => {
	const textArrayType = defaults.type.array(defaults.type.text)
	const intArrayType = defaults.type.array(defaults.type.integer)
	const floatArrayType = defaults.type.array(defaults.type.float)
	const boolArrayType = defaults.type.array(defaults.type.boolean)
	const dateArrayType = defaults.type.array(defaults.type.date)
	const varcharArrayType = defaults.type.array(defaults.type.text)
	expect(textArrayType.key).toBe("text[]")
	expect(intArrayType.key).toBe("integer[]")
	expect(floatArrayType.key).toBe("float[]")
	expect(boolArrayType.key).toBe("boolean[]")
	expect(dateArrayType.key).toBe("date[]")
	expect(varcharArrayType.key).toBe("text[]")
	expect(textArrayType.validate(["a".repeat(5), "b".repeat(8)])).toBe(true)
	expect(textArrayType.validate([""])).toBe(true)
	expect(textArrayType.validate([])).toBe(true)
	expect(textArrayType.validate([123, "world"])).toBe(false)
	expect(textArrayType.validate("not an array")).toBe(false)
	expect(textArrayType.validate(null)).toBe(false)
	expect(textArrayType.validate(undefined)).toBe(false)
	expect(intArrayType.validate([1, 2, 3])).toBe(true)
	expect(intArrayType.validate([0, -5, 10])).toBe(true)
	expect(intArrayType.validate([])).toBe(true)
	expect(intArrayType.validate([1, "2", 3])).toBe(false)
	expect(intArrayType.validate([1.5, 2, 3])).toBe(false)
	expect(floatArrayType.validate([1.5, 2.75, 3.0])).toBe(true)
	expect(floatArrayType.validate([0, -5.5, 10])).toBe(true)
	expect(floatArrayType.validate([])).toBe(true)
	expect(floatArrayType.validate([1.5, "2.5", 3])).toBe(false)
	expect(boolArrayType.validate([true, false, true])).toBe(true)
	expect(boolArrayType.validate([])).toBe(true)
	expect(boolArrayType.validate([true, "false"])).toBe(false)
	const now = new Date()
	expect(dateArrayType.validate([now, new Date("2023-01-01")])).toBe(true)
	expect(dateArrayType.validate([])).toBe(true)
	expect(dateArrayType.validate([now, "not a date"])).toBe(false)
	expect(varcharArrayType.validate(["a".repeat(5), "b".repeat(8)])).toBe(true)
	expect(varcharArrayType.validate([])).toBe(true)
	expect(varcharArrayType.validate([123, "text"])).toBe(false)
})
Deno.test("Array Type - Nested Arrays", () => {
	const nestedArrayType = defaults.type.array(defaults.type.array(defaults.type.text))
	expect(nestedArrayType.key).toBe("text[][]")
	expect(nestedArrayType.validate([["a".repeat(5), "b".repeat(5)], ["c".repeat(5), "d".repeat(5)]])).toBe(true)
	expect(nestedArrayType.validate([["single item"]])).toBe(true)
	expect(nestedArrayType.validate([[]])).toBe(true)
	expect(nestedArrayType.validate([])).toBe(true)
	expect(nestedArrayType.validate([["text"], 123])).toBe(false)
	expect(nestedArrayType.validate([["text"], [123]])).toBe(false)
})
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
		type: defaults.type.text,
		features: [defaults.feature.required],
	})
	name!: string
}
Deno.test("Array Type - Model Creation", async () => {
	const stringModel = await StringArrayModel.create({
		tags: ["a".repeat(5), "b".repeat(8), "c".repeat(10)],
	})
	expect(stringModel instanceof StringArrayModel).toBe(true)
	expect(stringModel.tags).toEqual(["a".repeat(5), "b".repeat(8), "c".repeat(10)])
	const emptyStringModel = await StringArrayModel.create({
		tags: [],
	})
	expect(emptyStringModel instanceof StringArrayModel).toBe(true)
	expect(emptyStringModel.tags).toEqual([])
	try {
		await StringArrayModel.create({
			tags: ["a".repeat(5), 123, "c".repeat(10)] as any,
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}
	const intModel = await IntArrayModel.create({
		scores: [85, 90, 95],
	})
	expect(intModel instanceof IntArrayModel).toBe(true)
	expect(intModel.scores).toEqual([85, 90, 95])
	try {
		await IntArrayModel.create({
			scores: [85, "90", 95] as any,
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}
	const multiModel = await MultiArrayModel.create({
		categories: ["a".repeat(10), "b".repeat(15)],
		quantities: [10, 20, 30],
		name: "a".repeat(20),
	})
	expect(multiModel instanceof MultiArrayModel).toBe(true)
	expect(multiModel.categories).toEqual(["a".repeat(10), "b".repeat(15)])
	expect(multiModel.quantities).toEqual([10, 20, 30])
	expect(multiModel.name).toBe("a".repeat(20))
	const partialModel = await MultiArrayModel.create({
		categories: ["a".repeat(5), "b".repeat(10)],
		name: "a".repeat(15),
	})
	expect(partialModel instanceof MultiArrayModel).toBe(true)
	expect(partialModel.categories).toEqual(["a".repeat(5), "b".repeat(10)])
	expect(partialModel.quantities).toBeUndefined()
})
Deno.test("Array Type - Real World Use Case", async () => {
	@Model.Decorator({
		database: defaults.database.store,
		binds: { create: { role: [] } },
	})
	class Product extends Model {
		@Field.Decorator({
			type: defaults.type.text,
			features: [defaults.feature.required],
		})
		name!: string
		@Field.Decorator({
			type: defaults.type.float,
			features: [defaults.feature.required],
		})
		price!: number
		@Field.Decorator({
			type: defaults.type.array(defaults.type.text),
			features: [defaults.feature.required],
		})
		categories!: string[]
		@Field.Decorator({
			type: defaults.type.array(defaults.type.text),
			features: [],
		})
		tags?: string[]
		@Field.Decorator({
			type: defaults.type.date,
			features: [defaults.feature.required],
		})
		createdOn!: Date
	}
	try {
		const product = await Product.create({
			name: "Smartphone",
			price: 599.99,
			categories: ["Electronics", "Mobile Devices"],
			tags: ["smartphone", "android", "5G"],
			createdOn: new Date(),
		})
		expect(product instanceof Product).toBe(true)
		expect(product.name).toBe("Smartphone")
		expect(product.price).toBe(599.99)
		expect(product.categories).toEqual(["Electronics", "Mobile Devices"])
		expect(product.tags).toEqual(["smartphone", "android", "5G"])
		expect(product.createdOn instanceof Date).toBe(true)
		try {
			await Product.create({
				name: "Invalid Laptop",
				price: 1299.99,
				categories: ["Electronics", 123],
				tags: ["laptop", "gaming"],
				createdOn: new Date(),
			} as any)
			expect(true).toBe(false)
		} catch (error) {
			expect(error instanceof FookieError).toBe(true)
		}
	} catch (error) {
		expect(error).toBeUndefined()
	}
})
