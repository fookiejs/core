import { defaults, Field, Model } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"

@Model.Decorator({
	database: defaults.database.store,
	binds: {
		create: { role: [] },
		read: { role: [] },
		update: { role: [] },
		delete: { role: [] },
	},
})
class OrderByModel extends Model {
	@Field.Decorator({ type: defaults.type.text })
	textField!: string

	@Field.Decorator({ type: defaults.type.integer })
	integerField!: number

	@Field.Decorator({ type: defaults.type.float })
	floatField!: number

	@Field.Decorator({ type: defaults.type.timestamp })
	createdAt!: Date
}
const now = new Date()
const past = new Date(now.getTime() - 1000 * 60 * 60) // 1 saat önce

Deno.test("Create OrderByModel", async () => {
	await OrderByModel.delete({})

	await OrderByModel.create({
		textField: "banana",
		integerField: 10,
		floatField: 2.5,
		createdAt: now,
	})

	await OrderByModel.create({
		textField: "apple",
		integerField: 5,
		floatField: 1.5,
		createdAt: past,
	})

	const textAsc = await OrderByModel.read({
		orderBy: { textField: "asc" },
	})
	expect(textAsc[0].textField).toBe("apple")
	expect(textAsc[1].textField).toBe("banana")
})

Deno.test("OrderBy for integer field", async () => {
	const intDesc = await OrderByModel.read({
		orderBy: { integerField: "desc" },
	})
	expect(intDesc[0].integerField).toBe(10)
	expect(intDesc[1].integerField).toBe(5)
})

Deno.test("OrderBy for float field", async () => {
	const floatAsc = await OrderByModel.read({
		orderBy: { floatField: "asc" },
	})
	expect(floatAsc[0].floatField).toBe(1.5)
	expect(floatAsc[1].floatField).toBe(2.5)
})

Deno.test("OrderBy for timestamp field", async () => {
	const dateAsc = await OrderByModel.read({
		orderBy: { createdAt: "asc" },
	})

	expect(new Date(dateAsc[0].createdAt).getTime()).toBe(past.getTime())
	expect(new Date(dateAsc[1].createdAt).getTime()).toBe(now.getTime())
})
