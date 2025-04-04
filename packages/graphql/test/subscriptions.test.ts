import { assertEquals } from "https://deno.land/std@0.217.0/assert/mod.ts"
import { defaults, Field, Method, Model } from "@fookiejs/core"
import { createResolvers, createTypeDefs, publishEvent } from "../src/index.ts"

Deno.test("Subscription - Type Definitions", () => {
	@Model.Decorator({ database: defaults.database.store })
	class User extends Model {
		@Field.Decorator({
			type: defaults.type.text,
			features: [defaults.feature.required],
		})
		name!: string
	}

	User
	const { typeDefs } = createTypeDefs()

	assertEquals(
		typeDefs.includes("type Subscription {"),
		true,
		"Should include Subscription type",
	)

	assertEquals(
		typeDefs.includes("userCreated: User"),
		true,
		"Should include userCreated subscription",
	)

	assertEquals(
		typeDefs.includes("userUpdated: User"),
		true,
		"Should include userUpdated subscription",
	)

	assertEquals(
		typeDefs.includes("userDeleted: ID"),
		true,
		"Should include userDeleted subscription",
	)
})

Deno.test("Subscription - Resolvers", () => {
	@Model.Decorator({})
	class User extends Model {
		@Field.Decorator({
			type: defaults.type.text,
			features: [defaults.feature.required],
		})
		name!: string
	}
	User
	const { resolvers } = createResolvers()

	assertEquals(
		typeof resolvers.Subscription,
		"object",
		"Should have Subscription resolver",
	)

	assertEquals(
		typeof resolvers.Subscription.userCreated,
		"object",
		"Should have userCreated resolver",
	)

	assertEquals(
		typeof resolvers.Subscription.userCreated.subscribe,
		"function",
		"userCreated should have subscribe function",
	)
})

Deno.test("Subscription - Event Publishing", async () => {
	@Model.Decorator({})
	class User extends Model {
		@Field.Decorator({
			type: defaults.type.text,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const user = { id: "1", name: "Test User" }

	const result = await publishEvent("1", User, Method.CREATE, user)
	assertEquals(result, true, "Should successfully publish event")
})
