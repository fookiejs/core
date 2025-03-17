import { defaults, Field, FookieError, Model, Role, Rule } from "@fookiejs/core"

import { expect } from "jsr:@std/expect"

const flag1 = { called: false }
const flag2 = { called: false }

const admin = Role.create({
	key: "admin",
	execute: async function (payload) {
		flag1.called = true
		return payload.options.sub === "admin"
	},
})

const rule_false = Rule.create({
	key: "rule_false",
	execute: async function () {
		flag2.called = true
		return false
	},
})

@Model.Decorator({
	database: defaults.database.store,
	binds: {
		read: {
			role: [admin],
			accepts: [
				[
					admin,
					{
						modify: [],
						rule: [rule_false],
					},
				],
			],
		},
		create: {
			role: [],
		},
	},
})
class TrueQueryTextModel extends Model {
	@Field.Decorator({ type: defaults.type.string })
	textField!: string
}

Deno.test("QueryTextModel Accept and Rule Lifecycle Tests", async () => {
	await TrueQueryTextModel.create({ textField: "abc" })
	await TrueQueryTextModel.create({ textField: "def" })
	await TrueQueryTextModel.create({ textField: "ghi" })

	Deno.test(
		"should call accept modify function and rule_true when admin role is accepted",
		async () => {
			flag1.called = false
			flag2.called = false

			try {
				await TrueQueryTextModel.read({}, { sub: "admin" })
				throw new Error("Bu noktaya ulaşmamalıydı")
			} catch (error) {
				expect(flag1.called).toBe(true)
				expect(flag2.called).toBe(false)
				expect(error instanceof FookieError).toBeTruthy()
			}
		},
	)

	Deno.test(
		"should not call accept modify function when role is not accepted",
		async () => {
			flag1.called = false
			flag2.called = false

			try {
				await TrueQueryTextModel.read({}, { sub: "user" })
				throw new Error("Bu noktaya ulaşmamalıydı")
			} catch (error) {
				expect(flag1.called).toBe(true)
				expect(flag2.called).toBe(false)
				expect(error instanceof FookieError).toBeTruthy()
			}
		},
	)
})
