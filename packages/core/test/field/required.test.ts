import { defaults, Field, FookieError, Model, TypeStandartization } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"

Deno.test("Define a required field with Error", async () => {
	@Model.Decorator({
		database: defaults.database.store,
		binds: { create: { role: [] } },
	})
	class RequiredField extends Model {
		@Field.Decorator({
			features: [defaults.feature.required],
			type: defaults.types[TypeStandartization.String],
		})
		field?: string
	}

	try {
		await RequiredField.create({})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
		expect(error.code === "RULE").toBe(true)
	}
})

Deno.test("Define a required field with Success", async () => {
	@Model.Decorator({
		database: defaults.database.store,
		binds: { create: { role: [] } },
	})
	class RequiredField2 extends Model {
		@Field.Decorator({
			features: [defaults.feature.required],
			type: defaults.types[TypeStandartization.String],
		})
		field!: string
	}

	const response = await RequiredField2.create({
		field: "fookie",
	})
	expect(response instanceof RequiredField2).toBe(true)
	if (response instanceof RequiredField2) {
		expect(response.field === "fookie").toBe(true)
	}
})
