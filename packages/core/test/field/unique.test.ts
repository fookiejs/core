import { expect } from "jsr:@std/expect"
import { defaults, Field, FookieError, Model, TypeStandartization } from "@fookiejs/core"

Deno.test("Define a unique field with Error", async () => {
	@Model.Decorator({
		database: defaults.database.store,
		binds: {
			read: { role: [] },
			create: { role: [] },
		},
	})
	class UniqueField extends Model {
		@Field.Decorator({
			features: [defaults.feature.unique],
			type: TypeStandartization.String,
		})
		username!: string
	}

	const firstResponse = await UniqueField.create({
		username: "uniqueUser",
	})

	expect(firstResponse instanceof UniqueField).toBe(true)

	try {
		const firstResponse = await UniqueField.create({
			username: "uniqueUser",
		})

		const secondResponse = await UniqueField.create({
			username: "uniqueUser",
		})

		console.log(firstResponse, secondResponse)

		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}
})
