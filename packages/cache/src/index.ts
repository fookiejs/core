import crypto from "node:crypto"
import {
	Config,
	type Database,
	defaults,
	Effect,
	Field,
	FookieError,
	Method,
	Mixin,
	Model,
	Modify,
} from "@fookiejs/core"

export function hasher(data: any): string {
	const hash = crypto.createHash("sha256")
	hash.update(JSON.stringify(data))
	return hash.digest("hex")
}

export interface CacheModule {
	FookieCache: typeof Model
	createMixin: (ttl: number) => Mixin
}

export function initCache(database: Database): CacheModule {
	@Model.Decorator({
		database: database,
		binds: {
			[Method.CREATE]: {
				role: [defaults.role.system],
			},
			[Method.READ]: {
				role: [defaults.role.system],
			},
			[Method.UPDATE]: {
				role: [defaults.role.nobody],
			},
			[Method.DELETE]: {
				role: [defaults.role.system],
			},
		},
	})
	class FookieCache extends Model {
		@Field.Decorator({
			type: defaults.type.string,
			features: [defaults.feature.required],
		})
		model!: string

		@Field.Decorator({
			type: defaults.type.string,
			features: [defaults.feature.required],
		})
		hash!: string

		@Field.Decorator({
			type: defaults.type.string,
			features: [defaults.feature.required],
		})
		data!: string

		@Field.Decorator({
			type: defaults.type.number,
			features: [defaults.feature.required],
		})
		expiresAt!: number
	}

	const isCached = Modify.create({
		key: "isCached",
		execute: async function (payload) {
			const cacheKey = hasher({
				sub: payload.options.sub,
				query: payload.query,
				model: payload.model.getName(),
			})

			const entries = await FookieCache.read(
				{
					filter: {
						hash: { equals: cacheKey },
						model: { equals: payload.model.getName() },
						expiresAt: { gt: Date.now() },
					},
				},
				{
					sub: Config.SYSTEM_TOKEN,
				},
			)

			if (!(entries instanceof FookieError) && entries.length > 0) {
				payload.state.cachedResponse = JSON.parse(entries[0].data)
			}
		},
	})

	const cacheResponse = (ttl: number) =>
		Effect.create({
			key: "cacheResponse",
			execute: async (payload, response) => {
				const cacheKey = hasher({
					sub: payload.options.sub,
					query: payload.query,
					model: payload.model.getName(),
				})

				const expiresAt = Date.now() + ttl

				await FookieCache.create(
					{
						model: payload.model.getName(),
						hash: cacheKey,
						data: JSON.stringify(response),
						expiresAt: expiresAt,
					},
					{
						sub: Config.SYSTEM_TOKEN,
					},
				)
			},
		})

	const cacheCreateResponse = (ttl: number) =>
		Effect.create({
			key: "cacheCreateResponse",
			execute: async (payload, response) => {
				const cacheKey = hasher({
					sub: payload.options?.sub || "anonymous",
					query: {
						filter: {
							id: {
								equals: payload.body.id,
							},
						},
						limit: 1,
					},
					model: payload.model.getName(),
				})

				const expiresAt = Date.now() + ttl

				await FookieCache.create(
					{
						model: payload.model.getName(),
						hash: cacheKey,
						data: JSON.stringify(response),
						expiresAt: expiresAt,
					},
					{
						sub: Config.SYSTEM_TOKEN,
					},
				)
			},
		})

	const clearModelCache = Effect.create({
		key: "clearCache",
		execute: async (payload) => {
			await FookieCache.delete(
				{
					filter: {
						model: { equals: payload.model.getName() },
					},
				},
				{
					sub: Config.SYSTEM_TOKEN,
				},
			)
		},
	})

	const clearExpiredCache = Effect.create({
		key: "clearExpiredCache",
		execute: async () => {
			await FookieCache.delete(
				{
					filter: {
						expiresAt: { lt: Date.now() },
					},
				},
				{
					sub: Config.SYSTEM_TOKEN,
				},
			)
		},
	})

	return {
		FookieCache: FookieCache,
		createMixin: function (ttl: number): Mixin {
			return Mixin.create({
				key: "cache",
				binds: {
					[Method.CREATE]: {
						effect: [
							clearModelCache,
							clearExpiredCache,
							cacheCreateResponse(ttl),
						],
					},
					[Method.READ]: {
						modify: [isCached],
						effect: [clearExpiredCache, cacheResponse(ttl)],
					},
					[Method.UPDATE]: {
						effect: [clearModelCache, clearExpiredCache],
					},
					[Method.DELETE]: {
						effect: [clearModelCache, clearExpiredCache],
					},
				},
			})
		},
	}
}
