import { defaults, Field, FookieError, Model, TypeStandartization } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"

Deno.test("Relation", () => {
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
	class RelationAddressModel extends Model {
		@Field.Decorator({ type: TypeStandartization.String })
		street?: string

		@Field.Decorator({ type: TypeStandartization.String })
		city?: string
	}

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
	class RelationUserModel extends Model {
		@Field.Decorator({ type: TypeStandartization.String })
		name?: string

		@Field.Decorator({ relation: RelationAddressModel })
		address?: string
	}

	Deno.test("Create an address and relate it to a user successfully", async () => {
		const addressResponse = await RelationAddressModel.create({
			street: "street",
			city: "city",
		})

		expect(addressResponse instanceof RelationAddressModel).toBe(true)

		if (addressResponse instanceof RelationAddressModel) {
			const userResponse = await RelationUserModel.create({
				name: "John Doe",
				address: addressResponse.id,
			})
			expect(userResponse instanceof RelationUserModel).toBe(true)

			if (userResponse instanceof RelationUserModel) {
				expect(addressResponse.id === userResponse.address).toBe(true)
			}
		}
	})

	Deno.test("Create an address and relate it to a user error", async () => {
		const userResponse = await RelationUserModel.create({
			name: "John Doe",
			address: "wrong-id",
		})

		expect(userResponse instanceof FookieError).toBe(true)

		if (userResponse instanceof FookieError) {
			expect(userResponse.code === "has_entity").toBeTruthy()
		}
	})
})
