import { expect } from "jsr:@std/expect"
import { defaults, Field, FookieError, Method, Model, TypeStandartization } from "@fookiejs/core"

Deno.test("Define a unique field with Error", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class UniqueField extends Model {
		@Field.Decorator({
			features: [defaults.feature.unique],
			type: TypeStandartization.String,
		})
		username!: string
	}

	// Add everybody role for CREATE method
	UniqueField.addLifecycle(Method.CREATE, defaults.role.everybody)

	const firstResponse = await UniqueField.create({
		username: "uniqueUser",
	})

	expect(firstResponse instanceof UniqueField).toBe(true)

	try {
		await UniqueField.create({
			username: "uniqueUser",
		})

		await UniqueField.create({
			username: "uniqueUser",
		})

		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}
})
