import { defaults, Field, Method, Model, TypeStandartization } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"

@Model.Decorator({
	database: defaults.database.store,
})
class OrderByModel extends Model {
	@Field.Decorator({ type: TypeStandartization.String })
	textField!: string

	@Field.Decorator({ type: TypeStandartization.Integer })
	integerField!: number

	@Field.Decorator({ type: TypeStandartization.Float })
	floatField!: number
}

OrderByModel.addLifecycle(Method.CREATE, defaults.role.everybody)
OrderByModel.addLifecycle(Method.READ, defaults.role.everybody)
OrderByModel.addLifecycle(Method.UPDATE, defaults.role.everybody)
OrderByModel.addLifecycle(Method.DELETE, defaults.role.everybody)

Deno.test("OrderBy Tests", async (t) => {
	await OrderByModel.delete({})

	const first = await OrderByModel.create({
		textField: "banana",
		integerField: 10,
		floatField: 2.5,
	})

	await new Promise((resolve) => setTimeout(resolve, 100))

	const second = await OrderByModel.create({
		textField: "apple",
		integerField: 5,
		floatField: 1.5,
	})

	await t.step("OrderBy text field ascending", async () => {
		const textAsc = await OrderByModel.read({
			orderBy: { textField: "asc" },
		})
		expect(textAsc[0].textField).toBe("apple")
		expect(textAsc[1].textField).toBe("banana")
	})

	await t.step("OrderBy integer field descending", async () => {
		const intDesc = await OrderByModel.read({
			orderBy: { integerField: "desc" },
		})
		expect(intDesc[0].integerField).toBe(10)
		expect(intDesc[1].integerField).toBe(5)
	})

	await t.step("OrderBy float field ascending", async () => {
		const floatAsc = await OrderByModel.read({
			orderBy: { floatField: "asc" },
		})
		expect(floatAsc[0].floatField).toBe(1.5)
		expect(floatAsc[1].floatField).toBe(2.5)
	})

	await t.step("OrderBy createdAt field ascending", async () => {
		const dateAsc = await OrderByModel.read({
			orderBy: { createdAt: "asc" },
		})
		expect(dateAsc[0].id).toBe(first.id)
		expect(dateAsc[1].id).toBe(second.id)
	})

	await t.step("OrderBy createdAt field descending", async () => {
		const dateDesc = await OrderByModel.read({
			orderBy: { createdAt: "desc" },
		})
		expect(dateDesc[0].id).toBe(second.id)
		expect(dateDesc[1].id).toBe(first.id)
	})
})
