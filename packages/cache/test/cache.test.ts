import { expect } from "jsr:@std/expect"
import { Config, defaults, Field, FookieError, Method, Model } from "@fookiejs/core"
import { initCache } from "@fookiejs/cache"

const database = defaults.database.store
const cacheModule = initCache(database)
const cacheMixin = cacheModule.createMixin
const cacheModel = cacheModule.FookieCache

@Model.Decorator({
	database: database,
	mixins: [cacheMixin(1 * 1000)],
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
		type: defaults.type.string,
	})
	name!: string
}

Deno.test("Cache", async () => {
	await cacheModel.delete(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	const testData = await TestModel.create({ name: "test" })
	expect(testData).not.toBeInstanceOf(FookieError)

	const firstRead = await TestModel.read({})
	expect(firstRead).not.toBeInstanceOf(FookieError)

	if (!(firstRead instanceof FookieError)) {
		expect(Array.isArray(firstRead)).toBe(true)
		expect(firstRead.length).toBe(1)
	}

	const isCached = await cacheModel.read(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	if (!(isCached instanceof FookieError)) {
		expect(Array.isArray(isCached)).toBe(true)
		expect(isCached.length).toBe(2)
	}

	const secondRead = await TestModel.read({})
	expect(secondRead).not.toBeInstanceOf(FookieError)

	if (!(secondRead instanceof FookieError)) {
		expect(Array.isArray(secondRead)).toBe(true)
		expect(secondRead.length).toBe(1)
		expect(secondRead).toEqual(firstRead)
	}
})

Deno.test("should clear cache on update", async () => {
	await cacheModel.delete(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	const testData = await TestModel.create({ name: "test" })
	expect(testData).not.toBeInstanceOf(FookieError)

	const firstRead = await TestModel.read({})
	expect(firstRead).not.toBeInstanceOf(FookieError)

	const isCached = await cacheModel.read(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	if (!(isCached instanceof FookieError)) {
		expect(Array.isArray(isCached)).toBe(true)
		expect(isCached.length).toBe(2)
	}

	if (!(testData instanceof FookieError)) {
		await TestModel.update(
			{
				filter: { id: { equals: testData.id } },
				limit: 1,
				offset: 0,
				attributes: [],
			},
			{ name: "updated" },
		)
	}

	const isCacheCleared = await cacheModel.read(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	if (!(isCacheCleared instanceof FookieError)) {
		expect(Array.isArray(isCacheCleared)).toBe(true)
		expect(isCacheCleared.length).toBe(0)
	}
})

Deno.test("should clear cache on delete", async () => {
	await cacheModel.delete(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	const testData = await TestModel.create({ name: "test" })
	expect(testData).not.toBeInstanceOf(FookieError)

	const firstRead = await TestModel.read({})
	expect(firstRead).not.toBeInstanceOf(FookieError)

	const isCached = await cacheModel.read(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	if (!(isCached instanceof FookieError)) {
		expect(Array.isArray(isCached)).toBe(true)
		expect(isCached.length).toBe(2)
	}

	if (!(testData instanceof FookieError)) {
		await TestModel.delete({
			filter: { id: { equals: testData.id } },
			limit: 1,
			offset: 0,
			attributes: [],
		})
	}

	const isCacheCleared = await cacheModel.read(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	if (!(isCacheCleared instanceof FookieError)) {
		expect(Array.isArray(isCacheCleared)).toBe(true)
		expect(isCacheCleared.length).toBe(0)
	}
})

Deno.test("should expire cache after TTL", async () => {
	await cacheModel.delete(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	const testData = await TestModel.create({ name: "test" })
	expect(testData).not.toBeInstanceOf(FookieError)

	const firstRead = await TestModel.read({})
	expect(firstRead).not.toBeInstanceOf(FookieError)

	const isCached = await cacheModel.read(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	if (!(isCached instanceof FookieError)) {
		expect(Array.isArray(isCached)).toBe(true)
		expect(isCached.length).toBe(2)
	}

	await new Promise((resolve) => setTimeout(resolve, 2 * 1000))

	const secondRead = await TestModel.read({})
	expect(secondRead).not.toBeInstanceOf(FookieError)

	const isCacheExpired = await cacheModel.read(
		{},
		{
			sub: Config.SYSTEM_TOKEN,
		},
	)

	if (!(isCacheExpired instanceof FookieError)) {
		expect(Array.isArray(isCacheExpired)).toBe(true)
		expect(isCacheExpired.length).toBe(1)
	}
})
