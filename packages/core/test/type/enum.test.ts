import { defaults, Field, FookieError, Model, TypeStandartization } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"
enum UserRole {
	ADMIN = "ADMIN",
	USER = "USER",
	GUEST = "GUEST",
}
@Model.Decorator({
	database: defaults.database.store,
	binds: { create: { role: [] } },
})
class EnumFieldModel extends Model {
	@Field.Decorator({
		type: TypeStandartization.Enum,
		enum: UserRole,
		features: [defaults.feature.required],
	})
	role!: UserRole
}
Deno.test("Enum Type - Valid Values", async () => {
	const model = await EnumFieldModel.create({ role: UserRole.ADMIN })
	expect(model instanceof EnumFieldModel).toBe(true)
	expect(model.role).toBe(UserRole.ADMIN)
})
Deno.test("Enum Type - Invalid Values", async () => {
	try {
		await EnumFieldModel.create({ role: "INVALID_ROLE" as UserRole })
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}
})
