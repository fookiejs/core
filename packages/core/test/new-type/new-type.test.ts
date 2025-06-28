import { defaults, Field, Model, TypeStandartization } from "@fookiejs/core"

@Model.Decorator({
	database: defaults.database.store,
})
class RootObject extends Model {
	@Field.Decorator({ type: TypeStandartization.String })
	name!: string
}

@Model.Decorator({
	database: defaults.database.store,
})
class ChildObject extends Model {
	@Field.Decorator({ type: TypeStandartization.String })
	name!: string

	@Field.Decorator({ relation: RootObject })
	root!: string
}

ChildObject
