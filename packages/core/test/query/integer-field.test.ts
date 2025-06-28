import { defaults, Field, FookieError, Method, Model, TypeStandartization } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"

Deno.test("QueryIntModel Query Tests", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class QueryIntModel extends Model {
		@Field.Decorator({ type: TypeStandartization.Integer })
		intField!: number
	}

	// Add everybody role for all methods
	QueryIntModel.addLifecycle(Method.CREATE, defaults.role.everybody)
	QueryIntModel.addLifecycle(Method.READ, defaults.role.everybody)

	await QueryIntModel.create({ intField: 1 })
	await QueryIntModel.create({ intField: 2 })
	await QueryIntModel.create({ intField: 3 })

	Deno.test("equals query", async () => {
		const results = await QueryIntModel.read({
			filter: {
				intField: { equals: 1 },
			},
		})
		expect(results).toHaveLength(1)
		expect(results[0].intField).toBe(1)
	})

	Deno.test("notEquals query", async () => {
		const results = await QueryIntModel.read({
			filter: {
				intField: { notEquals: 1 },
			},
		})

		expect(results).toHaveLength(2)
		expect(results[0].intField).not.toBe(1)
	})

	Deno.test("in query", async () => {
		const results = await QueryIntModel.read({
			filter: {
				intField: { in: [1, 2] },
			},
		})
		expect(results).toHaveLength(2)
		expect(results.map((r) => r.intField)).toEqual(
			expect.arrayContaining([1, 2]),
		)
	})

	Deno.test("notIn query", async () => {
		const results = await QueryIntModel.read({
			filter: {
				intField: { notIn: [1, 2] },
			},
		})
		expect(results).toHaveLength(1)
		expect(results[0].intField).toBe(3)
	})

	Deno.test("gte query", async () => {
		const results = await QueryIntModel.read({
			filter: {
				intField: { gte: 2 },
			},
		})
		expect(results).toHaveLength(2)
		expect(results.map((r) => r.intField)).toEqual(
			expect.arrayContaining([2, 3]),
		)
	})

	Deno.test("gt query", async () => {
		const results = await QueryIntModel.read({
			filter: {
				intField: { gt: 2 },
			},
		})
		expect(results).toHaveLength(1)
		expect(results[0].intField).toBe(3)
	})

	Deno.test("lte query", async () => {
		const results = await QueryIntModel.read({
			filter: {
				intField: { lte: 2 },
			},
		})
		expect(results).toHaveLength(2)
		expect(results.map((r) => r.intField)).toEqual(
			expect.arrayContaining([1, 2]),
		)
	})

	Deno.test("lt query", async () => {
		const results = await QueryIntModel.read({
			filter: {
				intField: { lt: 2 },
			},
		})
		expect(results).toHaveLength(1)
		expect(results[0].intField).toBe(1)
	})

	Deno.test("isNull query", async () => {
		const results = await QueryIntModel.read({
			filter: {
				intField: { isNull: true },
			},
		})
		expect(results).toHaveLength(0)
	})

	Deno.test("isNull query", async () => {
		const results = await QueryIntModel.read({
			filter: {
				intField: { isNull: true },
			},
		})
		expect(results).toHaveLength(0)
	})
})
