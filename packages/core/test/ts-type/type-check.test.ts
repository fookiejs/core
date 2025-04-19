import { defaults, Field, type Method, Model, Rule, TypeStandartization } from "@fookiejs/core"

Deno.test("Payload Type Safety Tests", () => {
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
	class _TypeCheckUser extends Model {
		@Field.Decorator({ type: defaults.types[TypeStandartization.String] })
		email!: string

		@Field.Decorator({ type: defaults.types[TypeStandartization.String] })
		username!: string
	}

	Deno.test("should have correct payload types for CREATE method", () => {
		Rule.create<_TypeCheckUser, Method.CREATE>({
			key: "create_test",
			execute: async (payload) => {
				payload.body.email
				payload.body.username
				return true
			},
		})
	})

	Deno.test("should have correct payload types for READ method", () => {
		Rule.create<_TypeCheckUser, Method.READ>({
			key: "read_test",
			execute: async (payload) => {
				payload.query.filter
				return true
			},
		})
	})

	Deno.test("should have correct payload types for UPDATE method", () => {
		Rule.create<_TypeCheckUser, Method.UPDATE>({
			key: "update_test",
			execute: async (payload) => {
				payload.query
				payload.body.email
				return true
			},
		})
	})

	Deno.test("should have correct payload types for DELETE method", () => {
		Rule.create<_TypeCheckUser, Method.DELETE>({
			key: "delete_test",
			execute: async (payload) => {
				payload.query
				return true
			},
		})
	})

	Deno.test("type parameter test", () => {
		Rule.create({
			key: "delete_test",
			execute: async (payload) => {
				payload.model
				payload.method
				return true
			},
		})

		Rule.create<_TypeCheckUser>({
			key: "delete_test",
			execute: async (payload) => {
				payload.model.read()
				payload.method
				return true
			},
		})
	})
})
