import { defaults, Field, Model, Role, TypeStandartization } from "@fookiejs/core"

Deno.test("Define a simple model", async () => {
	@Model.Decorator({
		database: defaults.database.store,
		binds: {
			read: {
				role: [],
			},
			create: {
				role: [
					Role.create({
						key: "example-lifecycle",
						execute: async function () {
							return true
						},
					}),
				],
			},
		},
	})
	class User extends Model {
		@Field.Decorator({
			features: [defaults.feature.required],
			type: defaults.types[TypeStandartization.String],
		})
		email!: string
	}
	User
})

Deno.test("Define a model with relations.", async () => {
	@Model.Decorator({
		database: defaults.database.store,
		binds: {},
	})
	class Address extends Model {
		@Field.Decorator({
			type: defaults.types[TypeStandartization.String],
			features: [defaults.feature.unique, defaults.feature.required],
		})
		city!: string
	}

	@Model.Decorator({
		database: defaults.database.store,
		binds: {},
	})
	class Place extends Model {
		@Field.Decorator({
			type: defaults.types[TypeStandartization.String],
			relation: Address,
			features: [defaults.feature.required],
		})
		address!: string
	}
	Place
})
