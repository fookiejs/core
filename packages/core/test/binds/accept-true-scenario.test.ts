import { expect } from "jsr:@std/expect"
import { defaults, Field, FookieError, Model, Modify, Role, Rule } from "@fookiejs/core"

const flag1 = { called: false }
const flag2 = { called: false }
const flag3 = { called: false }

const admin = Role.create({
	key: "admin",
	execute: async function (payload) {
		flag1.called = true
		return payload.options.sub === "admin"
	},
})

const acceptModifyFunction = Modify.create({
	key: "accept_modify",
	execute: async function (payload) {
		flag2.called = true
		payload.query.limit = 10
	},
})

const rule_true = Rule.create({
	key: "rule_true",
	execute: async function () {
		flag3.called = true
		return true
	},
})

@Model.Decorator({
	database: defaults.database.store,
	binds: {
		read: {
			role: [admin, defaults.role.everybody],
			accepts: [
				[
					admin,
					{
						modify: [acceptModifyFunction],
						rule: [rule_true],
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
			flag3.called = false
			const results = await TrueQueryTextModel.read({}, { sub: "admin" })
			expect(flag1.called).toBe(true)
			expect(flag2.called).toBe(true)
			expect(flag3.called).toBe(true)
			expect(results).toHaveLength(3)
		},
	)

	Deno.test(
		"should not call accept modify function when role is not accepted",
		async () => {
			flag1.called = false
			flag2.called = false
			flag3.called = false

			const results = await TrueQueryTextModel.read({}, { sub: "user" })

			expect(flag1.called).toBe(true)
			expect(flag2.called).toBe(false)
			expect(flag3.called).toBe(false)
			expect(results instanceof FookieError).toBeTruthy()
		},
	)
})
