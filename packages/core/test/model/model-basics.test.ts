import { defaults, Field, Model, Role, TypeStandartization } from "@fookiejs/core"

Deno.test("Define a simple model", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class User extends Model {
		@Field.Decorator({
			features: [defaults.feature.required],
			type: TypeStandartization.String,
		})
		email!: string
	}
	User
})

Deno.test("Define a model with relations.", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class Address extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			features: [defaults.feature.unique, defaults.feature.required],
		})
		city!: string
	}

	@Model.Decorator({
		database: defaults.database.store,
	})
	class Place extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			relation: Address,
			features: [defaults.feature.required],
		})
		address!: string
	}
	Place
})
