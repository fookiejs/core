import { expect } from "jsr:@std/expect"
import { Config, defaults, Field, FookieError, Method, Model, TypeStandartization } from "@fookiejs/core"
import { initCache } from "@fookiejs/cache"
const database = defaults.database.store
const cacheModule = initCache(database)
const cacheMixin = cacheModule.createMixin
const cacheModel = cacheModule.FookieCache
@Model.Decorator({
	database: database,
	mixins: [cacheMixin(1)],
	binds: {
		[Method.CREATE]: {
			role: [defaults.role.everybody],
		},
		[Method.READ]: {
			role: [defaults.role.everybody],
		},
		[Method.UPDATE]: {
			role: [defaults.role.everybody],
		},
		[Method.DELETE]: {
			role: [defaults.role.everybody],
		},
	},
})
class TestModel extends Model {
	@Field.Decorator({
		type: TypeStandartization.String,
	})
	name!: string
}
async function cleanup() {
	await TestModel.delete(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
			hardDelete: true,
		},
	)
	await cacheModel.delete(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
			hardDelete: true,
		},
	)
}
Deno.test("Cache - Soft Delete", async () => {
	await cleanup()
	const testData = await TestModel.create(
		{
			name: "test",
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(testData).not.toBeInstanceOf(FookieError)
	const firstRead = await TestModel.read(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(firstRead).not.toBeInstanceOf(FookieError)
	if (!(firstRead instanceof FookieError)) {
		expect(Array.isArray(firstRead)).toBe(true)
		expect(firstRead.length).toBe(1)
	}
	await TestModel.delete(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	const afterDelete = await TestModel.read(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(afterDelete).not.toBeInstanceOf(FookieError)
	if (!(afterDelete instanceof FookieError)) {
		expect(Array.isArray(afterDelete)).toBe(true)
		expect(afterDelete.length).toBe(0)
	}
})
Deno.test("Cache - Hard Delete", async () => {
	await cleanup()
	const testData = await TestModel.create(
		{
			name: "test",
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(testData).not.toBeInstanceOf(FookieError)
	const firstRead = await TestModel.read(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(firstRead).not.toBeInstanceOf(FookieError)
	if (!(firstRead instanceof FookieError)) {
		expect(Array.isArray(firstRead)).toBe(true)
		expect(firstRead.length).toBe(1)
	}
	await TestModel.delete(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
			hardDelete: true,
		},
	)
	const afterDelete = await TestModel.read(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(afterDelete).not.toBeInstanceOf(FookieError)
	if (!(afterDelete instanceof FookieError)) {
		expect(Array.isArray(afterDelete)).toBe(true)
		expect(afterDelete.length).toBe(0)
	}
})
Deno.test("Cache - Clear on Update", async () => {
	await cleanup()
	const testData = await TestModel.create(
		{
			name: "test",
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(testData).not.toBeInstanceOf(FookieError)
	const firstRead = await TestModel.read(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(firstRead).not.toBeInstanceOf(FookieError)
	if (!(firstRead instanceof FookieError)) {
		expect(Array.isArray(firstRead)).toBe(true)
		expect(firstRead.length).toBe(1)
	}
	if (!(testData instanceof FookieError)) {
		await TestModel.update(
			{
				filter: { id: { equals: testData.id } },
			},
			{
				name: "updated",
			},
			{
				token: Config.SYSTEM_TOKEN,
			},
		)
	}
	const afterUpdate = await TestModel.read(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(afterUpdate).not.toBeInstanceOf(FookieError)
	if (!(afterUpdate instanceof FookieError)) {
		expect(Array.isArray(afterUpdate)).toBe(true)
		expect(afterUpdate.length).toBe(1)
		expect(afterUpdate[0].name).toBe("updated")
	}
})
Deno.test("Cache - Expire", async () => {
	await cleanup()
	const testData = await TestModel.create(
		{
			name: "test",
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(testData).not.toBeInstanceOf(FookieError)
	const firstRead = await TestModel.read(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(firstRead).not.toBeInstanceOf(FookieError)
	if (!(firstRead instanceof FookieError)) {
		expect(Array.isArray(firstRead)).toBe(true)
		expect(firstRead.length).toBe(1)
	}
	await new Promise((resolve) => setTimeout(resolve, 2000))
	const afterExpire = await TestModel.read(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(afterExpire).not.toBeInstanceOf(FookieError)
	if (!(afterExpire instanceof FookieError)) {
		expect(Array.isArray(afterExpire)).toBe(true)
		expect(afterExpire.length).toBe(1)
	}
	const cacheEntries = await cacheModel.read(
		{
			filter: {},
		},
		{
			token: Config.SYSTEM_TOKEN,
		},
	)
	expect(cacheEntries).not.toBeInstanceOf(FookieError)
	if (!(cacheEntries instanceof FookieError)) {
		expect(Array.isArray(cacheEntries)).toBe(true)
		expect(cacheEntries.length).toBe(1)
	}
})
