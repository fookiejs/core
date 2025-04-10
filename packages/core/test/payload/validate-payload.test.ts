import { expect } from "jsr:@std/expect"
import { defaults, Field, FookieError, Model } from "@fookiejs/core"

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
	@Field.Decorator({ type: defaults.type.text })
	textField!: string
}

Deno.test("QueryTextModel validate_payload Tests", async () => {
	await QueryTextModel.create({ textField: "abc" })
	await QueryTextModel.create({ textField: "def" })
	await QueryTextModel.create({ textField: "ghi" })

	Deno.test("should throw error if options is not an object", async () => {
		try {
			await QueryTextModel.read({}, { test: "invalid_option" })
			expect(false).toBeTruthy()
		} catch (error) {
			expect(error instanceof FookieError).toBeTruthy()
		}
	})

	Deno.test("should throw error if options.token is not a string", async () => {
		try {
			await QueryTextModel.read(
				{},
				{
					token: "invalid_token" as any,
				},
			)
			expect(false).toBeTruthy()
		} catch (error) {
			expect(error instanceof FookieError).toBeTruthy()
		}
	})

	Deno.test("should throw error if body is not an object", async () => {
		try {
			await QueryTextModel.create({ textField: 123 } as any)
			expect(false).toBeTruthy()
		} catch (error) {
			expect(error instanceof FookieError).toBeTruthy()
		}
	})

	Deno.test("should throw error if body properties are invalid", async () => {
		try {
			await QueryTextModel.create({
				invalidField: 1,
			} as any)
			expect(false).toBeTruthy()
		} catch (error) {
			expect(error instanceof FookieError).toBeTruthy()
		}
	})

	Deno.test("should throw error if filter is not valid", async () => {
		try {
			await QueryTextModel.read({
				filter: {
					invalidField: { equals: "abc" },
				} as any,
			})
			expect(false).toBeTruthy()
		} catch (error) {
			expect(error instanceof FookieError).toBeTruthy()
		}
	})

	Deno.test("should throw error if query is not a object", async () => {
		try {
			await QueryTextModel.read({} as any)
			expect(false).toBeTruthy()
		} catch (error) {
			expect(error instanceof FookieError).toBeTruthy()
		}
	})

	Deno.test("should return results for valid payload", async () => {
		const results = await QueryTextModel.read({
			filter: {
				textField: { equals: "abc" },
			},
		})
		expect(results).toHaveLength(1)
		expect(results[0].textField).toBe("abc")
	})
})
