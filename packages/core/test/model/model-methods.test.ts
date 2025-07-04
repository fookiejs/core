import { expect } from "jsr:@std/expect"

import { defaults, Field, Method, Model, Role, TypeStandartization } from "@fookiejs/core"

@Model.Decorator({
	database: defaults.database.store,
})
class User extends Model {
	@Field.Decorator({
		features: [defaults.feature.required],
		type: TypeStandartization.String,
	})
	email!: string

	@Field.Decorator({
		features: [defaults.feature.required],
		type: TypeStandartization.Integer,
	})
	usage!: number
}

// Add everybody role for all methods
User.addLifecycle(Method.CREATE, defaults.role.everybody)
User.addLifecycle(Method.READ, defaults.role.everybody)
User.addLifecycle(Method.UPDATE, defaults.role.everybody)
User.addLifecycle(Method.DELETE, defaults.role.everybody)

Deno.test("should create a user correctly", async () => {
	const createResponse = await User.create({
		email: "test@fookiejs.com",
		usage: 3,
	})
	expect(createResponse instanceof User).toEqual(true)
	expect(createResponse.email).toEqual("test@fookiejs.com")
	expect(createResponse.id).toBeDefined()
})

Deno.test("should read users correctly", async () => {
	const readResponse = await User.read({})
	expect(Array.isArray(readResponse)).toEqual(true)
})

Deno.test("should update a user correctly", async () => {
	const initialUser = await User.create({
		email: "to-update@test.com",
		usage: 5,
	})
	if (!initialUser || !initialUser.id) {
		throw new Error("Failed to create user for update test")
	}

	const updateResponse = await User.update(
		{
			filter: {
				id: { equals: initialUser.id },
			},
			limit: Infinity,
			offset: 0,
			attributes: [],
		},
		{ email: "tester@fookiejs.com" },
	)
	expect(updateResponse.length).toEqual(1)

	await User.read({
		filter: { id: { equals: initialUser.id } },
	})
})

Deno.test("should soft delete a user by default", async () => {
	const userToDelete = await User.create({
		email: "soft-delete@test.com",
		usage: 15,
	})

	const deleteResponse = await User.delete({
		filter: {
			id: { equals: userToDelete.id },
		},
	})

	expect(deleteResponse.length).toEqual(1)

	const deletedUser = await User.read({
		filter: {
			id: { equals: userToDelete.id },
		},
	})

	expect(deletedUser.length).toBe(0)
})

Deno.test("should hard delete a user when hardDelete is true", async () => {
	const userToDelete = await User.create({
		email: "hard-delete@test.com",
		usage: 15,
	})

	const deleteResponse = await User.delete({
		filter: {
			id: { equals: userToDelete.id },
		},
	}, {
		hardDelete: true,
	})

	expect(deleteResponse.length).toEqual(1)

	const deletedUser = await User.read({
		filter: {
			id: { equals: userToDelete.id },
		},
	})

	expect(deletedUser.length).toBe(0)
})
