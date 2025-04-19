import { assertEquals } from "https://deno.land/std/assert/mod.ts"
import { Config, defaults } from "@fookiejs/core"
import { initAuth } from "../mod.ts"

const database = defaults.database.store
const { Account } = initAuth(database)

Deno.test("Account CRUD Operations with System Role", async (t) => {
	await t.step("CREATE - Should create a new account", async () => {
		const account = await Account.create({
			iss: "test_issuer",
			sub: "test_subject",
			email: "test@example.com",
			name: "Test User",
			picture: "https://example.com/picture.jpg",
		}, {
			token: Config.SYSTEM_TOKEN,
		})

		assertEquals(account.email, "test@example.com")
		assertEquals(account.name, "Test User")
	})

	await t.step("READ - Should read created account", async () => {
		const accounts = await Account.read({
			filter: {
				email: { equals: "test@example.com" },
			},
		}, {
			token: Config.SYSTEM_TOKEN,
		})

		assertEquals(accounts.length, 1)
		assertEquals(accounts[0].email, "test@example.com")
	})

	await t.step("UPDATE - Should update account", async () => {
		const accounts = await Account.read({
			filter: {
				email: { equals: "test@example.com" },
			},
		}, {
			token: Config.SYSTEM_TOKEN,
		})

		const updated = await Account.update({
			filter: {
				id: { equals: accounts[0].id },
			},
		}, {
			name: "Updated Test User",
		}, {
			token: Config.SYSTEM_TOKEN,
		})

		assertEquals(updated.length, 1)

		const verifyUpdate = await Account.read({
			filter: {
				id: { equals: accounts[0].id },
			},
		}, {
			token: Config.SYSTEM_TOKEN,
		})

		assertEquals(verifyUpdate[0].name, "Updated Test User")
	})

	await t.step("DELETE - Should delete account", async () => {
		const accounts = await Account.read({
			filter: {
				email: { equals: "test@example.com" },
			},
		}, {
			token: Config.SYSTEM_TOKEN,
		})

		const deleted = await Account.delete({
			filter: {
				id: { equals: accounts[0].id },
			},
		}, {
			token: Config.SYSTEM_TOKEN,
		})

		assertEquals(deleted.length, 1)

		const verifyDelete = await Account.read({
			filter: {
				email: { equals: "test@example.com" },
			},
		}, {
			token: Config.SYSTEM_TOKEN,
		})

		assertEquals(verifyDelete.length, 0)
	})
})
