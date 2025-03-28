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
})

Deno.test("should read users correctly", async () => {
	const readResponse = await User.read({})
	expect(Array.isArray(readResponse)).toEqual(true)
})

Deno.test("should update a user correctly", async () => {
	const users = await User.read({})
	const updateResponse = await User.update(
		{
			filter: {
				id: {
					in: users.map((u) => u.id),
				},
			},
			limit: Infinity,
			offset: 0,
			attributes: [],
		},
		{
			email: "tester@fookiejs.com",
		},
	)
	expect(updateResponse).toEqual(true)
})

Deno.test("should delete a user correctly", async () => {
	const deleteResponse = await User.delete({
		filter: {
			id: {
				equals: "example-id",
			},
		},
	})
	expect(deleteResponse).toEqual(true)
})
