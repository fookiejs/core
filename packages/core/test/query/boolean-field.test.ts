import { expect } from "jsr:@std/expect"
import { defaults, Field, FookieError, Method, Model, TypeStandartization } from "@fookiejs/core"

Deno.test("QueryBooleanModel Query Tests", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class QueryBooleanModel extends Model {
		@Field.Decorator({ type: TypeStandartization.Boolean })
		booleanField!: boolean
	}

	// Add everybody role for all methods
	QueryBooleanModel.addLifecycle(Method.CREATE, defaults.role.everybody)
	QueryBooleanModel.addLifecycle(Method.READ, defaults.role.everybody)

	await QueryBooleanModel.create({ booleanField: true })
	await QueryBooleanModel.create({ booleanField: false })
	await QueryBooleanModel.create({ booleanField: true })

	Deno.test("equals query", async () => {
		const results = await QueryBooleanModel.read({
			filter: {
				booleanField: { equals: true },
			},
		})
		expect(results).toHaveLength(2)
		expect(results.every((r) => r.booleanField === true)).toBe(true)
	})

	Deno.test("notEquals query", async () => {
		const results = await QueryBooleanModel.read({
			filter: {
				booleanField: { notEquals: true },
			},
		})
		expect(results).toHaveLength(1)
		expect(results[0].booleanField).toBe(false)
	})

	Deno.test("isNull query", async () => {
		const results = await QueryBooleanModel.read({
			filter: {
				booleanField: { isNull: true },
			},
		})

		expect(results).toHaveLength(0)
	})
})
