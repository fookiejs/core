import { expect } from "jsr:@std/expect"
import {
	addGlobalEffect,
	addGlobalRule,
	defaults,
	Effect,
	Field,
	type Method,
	Model,
	type Payload,
	Rule,
	TypeStandartization,
} from "@fookiejs/core"

Deno.test("fillModel Function Tests", () => {
	let flag1 = false
	let flag2 = false

	@Model.Decorator({
		database: defaults.database.store,
		binds: { create: { role: [] } },
		mixins: [],
	})
	class TestModel extends Model {
		@Field.Decorator({
			type: defaults.types[TypeStandartization.String],
			features: [defaults.feature.required],
		})
		exampleField!: string
	}

	addGlobalEffect(
		Effect.create({
			key: "global-test-flag-effect",
			execute: async function (): Promise<void> {
				flag1 = true
			},
		}),
	)

	addGlobalRule(
		Rule.create({
			key: "global-test-flag-pre-rule",
			execute: async function (payload: Payload<TestModel, Method>) {
				payload
				flag2 = true
				return true
			},
		}),
	)

	Deno.test("flag and test global", async () => {
		await TestModel.create({ exampleField: "hi" })

		expect(flag1).toBe(true)
	})

	Deno.test("flag and test global", async () => {
		await TestModel.read()
		expect(flag2).toBe(true)
	})
})
