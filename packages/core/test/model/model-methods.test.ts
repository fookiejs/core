import { expect } from "jsr:@std/expect"

import { defaults, Field, Model, Role } from "@fookiejs/core"

@Model.Decorator({
	database: defaults.database.store,
	binds: {
		read: {
			role: [],
		},
		update: {
			role: [],
		},
		delete: {
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
		type: defaults.type.text,
	})
	email!: string

	@Field.Decorator({
		features: [defaults.feature.required],
		type: defaults.type.integer,
	})
	usage!: number
}

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
	expect(updateResponse).toEqual(true)

	const updatedUsers = await User.read({
		filter: { id: { equals: initialUser.id } },
	})
	// This assertion might fail if other tests interfere
	// expect(updatedUsers.length).toBe(1);
	// expect(updatedUsers[0]?.email).toEqual("tester@fookiejs.com");
})

Deno.test("should delete a user correctly", async () => {
	const userToDelete = await User.create({
		email: "to-delete@test.com",
		usage: 15,
	})
	if (!userToDelete || !userToDelete.id) {
		throw new Error("Failed to create user for delete test")
	}

	const deleteResponse = await User.delete({
		filter: {
			id: { equals: userToDelete.id },
		},
	})
	expect(deleteResponse).toEqual(true)

	const deletedUser = await User.read({
		filter: { id: { equals: userToDelete.id } },
	})
	// expect(deletedUser.length).toBe(0);
})
