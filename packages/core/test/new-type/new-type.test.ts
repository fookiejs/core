import { defaults, Field, Model, TypeStandartization } from "@fookiejs/core"

@Model.Decorator({
	database: defaults.database.store,
	binds: {
		read: { role: [] },
	},
})
class RootObject extends Model {
	@Field.Decorator({ type: defaults.types[TypeStandartization.String] })
	name!: string
}

@Model.Decorator({
	database: defaults.database.store,
	binds: {
		read: { role: [] },
	},
})
class ChildObject extends Model {
	@Field.Decorator({ type: defaults.types[TypeStandartization.String] })
	name!: string

	@Field.Decorator({ relation: RootObject })
	root!: string
}

ChildObject
