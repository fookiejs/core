import { defaults, Field, Model } from "@fookiejs/core"

@Model.Decorator({
	database: defaults.database.store,
	binds: {
		read: { role: [] },
	},
})
class RootObject extends Model {
	@Field.Decorator({ type: defaults.type.string })
	name!: string
}

@Model.Decorator({
	database: defaults.database.store,
	binds: {
		read: { role: [] },
	},
})
class ChildObject extends Model {
	@Field.Decorator({ type: defaults.type.string })
	name!: string

	@Field.Decorator({ relation: RootObject })
	root!: string
}
