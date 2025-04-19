import { defaults, Field, FookieError, Model, TypeStandartization } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"

@Model.Decorator({
	database: defaults.database.store,
	binds: { create: { role: [] } },
})
class StringArrayModel extends Model {
	@Field.Decorator({
		type: TypeStandartization.String,
		isArray: true,
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
		type: TypeStandartization.Integer,
		isArray: true,
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
		type: TypeStandartization.String,
		isArray: true,
		features: [defaults.feature.required],
	})
	categories!: string[]

	@Field.Decorator({
		type: TypeStandartization.Integer,
		isArray: true,
		features: [],
	})
	quantities?: number[]

	@Field.Decorator({
		type: TypeStandartization.String,
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
			type: TypeStandartization.String,
			features: [defaults.feature.required],
		})
		name!: string

		@Field.Decorator({
			type: TypeStandartization.Float,
			features: [defaults.feature.required],
		})
		price!: number

		@Field.Decorator({
			type: TypeStandartization.String,
			isArray: true,
			features: [defaults.feature.required],
		})
		categories!: string[]

		@Field.Decorator({
			type: TypeStandartization.String,
			isArray: true,
			features: [],
		})
		tags?: string[]

		@Field.Decorator({
			type: TypeStandartization.Date,
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
