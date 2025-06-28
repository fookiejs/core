import { expect } from "jsr:@std/expect"
import { defaults, Field, Method, Model, TypeStandartization } from "@fookiejs/core"

Deno.test("Define a field with a default value", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class DefaultFieldModel extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			default: "defaultVal",
		})
		myField?: string
	}

	// Add everybody role for all methods
	DefaultFieldModel.addLifecycle(Method.CREATE, defaults.role.everybody)
	DefaultFieldModel.addLifecycle(Method.READ, defaults.role.everybody)
	DefaultFieldModel.addLifecycle(Method.UPDATE, defaults.role.everybody)
	DefaultFieldModel.addLifecycle(Method.DELETE, defaults.role.everybody)

	const response = await DefaultFieldModel.create({})
	expect(response instanceof DefaultFieldModel).toBe(true)
	if (response instanceof DefaultFieldModel) {
		expect(response.myField).toBe("defaultVal")
	}
})
