import { defaults, Field, FookieError, Model, TypeStandartization } from "@fookiejs/core"
import { v4 } from "uuid"
import { expect } from "jsr:@std/expect"

Deno.test("Relation", () => {
	@Model.Decorator({
		database: defaults.database.store,
		binds: {
			create: {
				role: [],
			},
			read: {
				role: [],
			},
		},
	})
	class RelationExistParent extends Model {
		@Field.Decorator({ type: TypeStandartization.String })
		name?: string
	}

	@Model.Decorator({
		database: defaults.database.store,
		binds: {
			create: {
				role: [],
			},
		},
	})
	class RelationExistChild extends Model {
		@Field.Decorator({ relation: RelationExistParent })
		parent?: string
	}

	Deno.test("Create a child for an existing parent", async () => {
		const entity = await RelationExistParent.create({ name: "John Doe" })
		const response = await RelationExistChild.create({ parent: entity.id })

		expect(response instanceof RelationExistChild).toBe(true)
	})

	Deno.test("Create a child for an not existing parent", async () => {
		const response = await RelationExistChild.create({ parent: v4() })

		expect(response instanceof FookieError).toBe(true)
		if (response instanceof FookieError) {
			expect(response.code).toBe("has_entity")
		}
	})
})
