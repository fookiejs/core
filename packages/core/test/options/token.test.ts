import { expect } from "jsr:@std/expect"
import { defaults, Field, FookieError, Model, Role, TypeStandartization } from "@fookiejs/core"
import { v4 } from "uuid"

Deno.test("Relation", () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class Token extends Model {
		@Field.Decorator({ type: TypeStandartization.String })
		name!: string
	}

	Deno.test("should create an entity with valid token", async () => {
		const entity = await Token.create(
			{ name: v4() },
			{
				token: "token",
			},
		)

		expect(entity instanceof Token).toBe(true)
	})

	Deno.test("should fail to create an entity with invalid token", async () => {
		const entity = await Token.create(
			{ name: v4() },
			{
				token: "invalid_token",
			},
		)

		expect(entity instanceof FookieError).toBe(true)
	})
})
