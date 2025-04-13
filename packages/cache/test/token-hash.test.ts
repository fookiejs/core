import { assertEquals, assertNotEquals } from "https://deno.land/std@0.217.0/assert/mod.ts"
import { Config, defaults, Field, Model } from "@fookiejs/core"
import { initCache } from "../src/index.ts"

const database = defaults.database.store
const { FookieCache, createMixin } = initCache(database)
const cacheMixin = createMixin(60)

Deno.test("Cache Token Hash - Different Entries For Different Tokens", async () => {
	@Model.Decorator({
		database,
		mixins: [cacheMixin],
		name: "TestModelDifferentTokens",
		binds: {
			create: { role: [defaults.role.everybody] },
			read: { role: [defaults.role.everybody] },
			update: { role: [defaults.role.everybody] },
			delete: { role: [defaults.role.everybody] },
		},
	})
	class TestModelDifferentTokens extends Model {
		@Field.Decorator({
			type: defaults.type.text,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const model1 = await TestModelDifferentTokens.create({ name: "test1" }, { token: "token1" })
	const model2 = await TestModelDifferentTokens.create({ name: "test2" }, { token: "token2" })

	const cacheEntries = await FookieCache.read({}, { token: Config.SYSTEM_TOKEN })
	const token1Entries = cacheEntries.filter((entry) => entry.tokenHash)

	assertEquals(token1Entries.length, 2, "Should have two cache entries with token hashes")
	assertNotEquals(
		token1Entries[0].tokenHash,
		token1Entries[1].tokenHash,
		"Different tokens should have different hashes",
	)
})

Deno.test("Cache Token Hash - Clear Only Specific Token Cache", async () => {
	@Model.Decorator({
		database,
		mixins: [cacheMixin],
		name: "TestModelClearSpecific",
		binds: {
			create: { role: [defaults.role.everybody] },
			read: { role: [defaults.role.everybody] },
			update: { role: [defaults.role.everybody] },
			delete: { role: [defaults.role.everybody] },
		},
	})
	class TestModel extends Model {
		@Field.Decorator({
			type: defaults.type.text,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const model3 = await TestModel.create({ name: "test3" }, { token: "token3" })
	const model4 = await TestModel.create({ name: "test4" }, { token: "token4" })

	const beforeClear = await FookieCache.read({
		filter: { model: { equals: "TestModelClearSpecific" } },
	}, { token: Config.SYSTEM_TOKEN })

	await TestModel.delete({ filter: { id: { equals: model3.id } } }, { token: "token3" })

	const afterClear = await FookieCache.read({
		filter: { model: { equals: "TestModelClearSpecific" } },
	}, { token: Config.SYSTEM_TOKEN })

	assertEquals(beforeClear.length - 1, afterClear.length, "Should only remove cache entries for token3")
})

Deno.test("Cache Token Hash - Handle System Token", async () => {
	@Model.Decorator({
		database,
		mixins: [cacheMixin],
		name: "TestModelSystemToken",
		binds: {
			create: { role: [defaults.role.everybody] },
			read: { role: [defaults.role.everybody] },
			update: { role: [defaults.role.everybody] },
			delete: { role: [defaults.role.everybody] },
		},
	})
	class TestModel extends Model {
		@Field.Decorator({
			type: defaults.type.text,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const model5 = await TestModel.create({ name: "test5" }, { token: Config.SYSTEM_TOKEN })

	const cacheEntries = await FookieCache.read({
		filter: { model: { equals: "TestModelSystemToken" } },
	}, { token: Config.SYSTEM_TOKEN })

	const systemTokenEntries = cacheEntries.filter((entry) => !entry.tokenHash)
	assertEquals(systemTokenEntries.length > 0, true, "System token should create cache entries without tokenHash")
})

Deno.test("Cache Token Hash - Handle Cache Read With Tokens", async () => {
	@Model.Decorator({
		database,
		mixins: [cacheMixin],
		name: "TestModelCacheRead",
		binds: {
			create: { role: [defaults.role.everybody] },
			read: { role: [defaults.role.everybody] },
			update: { role: [defaults.role.everybody] },
			delete: { role: [defaults.role.everybody] },
		},
	})
	class TestModel extends Model {
		@Field.Decorator({
			type: defaults.type.text,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const model6 = await TestModel.create({ name: "test6" }, { token: "token6" })

	const firstRead = await TestModel.read({
		filter: { id: { equals: model6.id } },
	}, { token: "token6" })

	const secondRead = await TestModel.read({
		filter: { id: { equals: model6.id } },
	}, { token: "token6" })

	assertEquals(firstRead, secondRead, "Cached read should return same data")

	const differentTokenRead = await TestModel.read({
		filter: { id: { equals: model6.id } },
	}, { token: "different_token" })

	assertNotEquals(differentTokenRead, undefined, "Different token should trigger new cache entry")
})
