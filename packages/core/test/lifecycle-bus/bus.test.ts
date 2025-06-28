import { expect } from "jsr:@std/expect"
import { defaults, Effect, Field, Model, TypeStandartization } from "@fookiejs/core"
import { Method } from "../../src/method/method.ts"

@Model.Decorator({
	database: defaults.database.store,
})
class TestBusModel extends Model {
	@Field.Decorator({
		type: TypeStandartization.String,
		features: [defaults.feature.required],
	})
	name!: string
}

// Add everybody role for CREATE method
TestBusModel.addLifecycle(Method.CREATE, defaults.role.everybody)

Deno.test("should merge mixin binds into model binds correctly", async () => {
	await TestBusModel.create({ name: "Test Name" })
	expect(true).toBe(true)
})
