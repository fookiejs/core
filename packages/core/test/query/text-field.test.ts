import { defaults, Field, FookieError, Model, TypeStandartization } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"

Deno.test("QueryTextModel Query Tests", async () => {
	@Model.Decorator({
		database: defaults.database.store,
		binds: {
			read: {
				role: [],
			},
			create: {
				role: [],
			},
		},
	})
	class QueryTextModel extends Model {
		@Field.Decorator({ type: TypeStandartization.String })
		textField!: string
	}

	await QueryTextModel.create({ textField: "abc" })
	await QueryTextModel.create({ textField: "def" })
	await QueryTextModel.create({ textField: "ghi" })

	Deno.test("equals query", async () => {
		const results = await QueryTextModel.read({
			filter: {
				textField: { equals: "abc" },
			},
		})
		expect(results).toHaveLength(1)
		expect(results[0].textField).toBe("abc")
	})

	Deno.test("notEquals query", async () => {
		const results = await QueryTextModel.read({
			filter: {
				textField: { notEquals: "abc" },
			},
		})
		expect(results).toHaveLength(2)
		expect(results[0].textField).not.toBe("abc")
	})

	Deno.test("in query", async () => {
		const results = await QueryTextModel.read({
			filter: {
				textField: { in: ["abc", "def"] },
			},
		})
		expect(results).toHaveLength(2)
		expect(results.map((r) => r.textField)).toEqual(
			expect.arrayContaining(["abc", "def"]),
		)
	})

	Deno.test("notIn query", async () => {
		const results = await QueryTextModel.read({
			filter: {
				textField: { notIn: ["abc", "def"] },
			},
		})
		expect(results).toHaveLength(1)
		expect(results[0].textField).toBe("ghi")
	})

	Deno.test("like query", async () => {
		const results = await QueryTextModel.read({
			filter: {
				textField: { like: "%a%" },
			},
		})
		expect(results).toHaveLength(1)
		expect(results[0].textField).toBe("abc")
	})

	Deno.test("isNull query", async () => {
		const results = await QueryTextModel.read({
			filter: {
				textField: { isNull: true },
			},
		})

		expect(results).toHaveLength(0)
	})

	Deno.test("notExist query", async () => {
		const results = await QueryTextModel.read({
			filter: {
				textField: { notExist: false },
			},
		})
		expect(results instanceof FookieError).toBeTruthy()
	})
})
