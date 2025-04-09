import crypto from "node:crypto"
import moment from "moment"
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

interface CacheModule {
	createMixin: (ttl: number) => Mixin
	FookieCache: typeof Model & {
		new (): Model & {
			model: string
			hash: string
			data: string
			expiresAt: string
		}
	}
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
			type: defaults.type.text,
			features: [defaults.feature.required],
		})
		model!: string

		@Field.Decorator({
			type: defaults.type.text,
			features: [defaults.feature.required, defaults.feature.unique],
		})
		hash!: string

		@Field.Decorator({
			type: defaults.type.text,
			features: [defaults.feature.required],
		})
		data!: string

		@Field.Decorator({
			type: defaults.type.timestamp,
			features: [defaults.feature.required],
		})
		expiresAt!: string
	}

	const isCached = Modify.create({
		key: "isCached",
		execute: async function (payload) {
			const cacheKey = hasher({
				token: payload.options.token,
				query: payload.query,
				model: payload.model.getName(),
			})

			const entries = await FookieCache.read(
				{
					filter: {
						hash: { equals: cacheKey },
						model: { equals: payload.model.getName() },
						expiresAt: { gt: moment().utc().toString() },
					},
				},
				{
					token: Config.SYSTEM_TOKEN,
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
					token: payload.options.token,
					query: payload.query,
					model: payload.model.getName(),
				})

				const expiresAt = moment().utc().add(ttl, "seconds").toString()
				try {
					await FookieCache.create(
						{
							model: payload.model.getName(),
							hash: cacheKey,
							data: JSON.stringify(response),
							expiresAt: expiresAt,
						},
						{
							token: Config.SYSTEM_TOKEN,
						},
					)
				} catch (error) {
					error
				}
			},
		})

	const cacheCreateResponse = (ttl: number) =>
		Effect.create({
			key: "cacheCreateResponse",
			execute: async (payload, response) => {
				const cacheKey = hasher({
					token: payload.options?.token || "anonymous",
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

				const expiresAt = moment().utc().add(ttl, "seconds").toString()
				try {
					await FookieCache.create(
						{
							model: payload.model.getName(),
							hash: cacheKey,
							data: JSON.stringify(response),
							expiresAt: expiresAt,
						},
						{
							token: Config.SYSTEM_TOKEN,
						},
					)
				} catch (error) {
					error
				}
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
					token: Config.SYSTEM_TOKEN,
				},
			)
		},
	})

	const clearExpiredCache = Effect.create({
		key: "clearExpiredCache",
		execute: async () => {
			try {
				await FookieCache.delete(
					{
						filter: {
							expiresAt: { lt: moment().utc().toString() },
						},
					},
					{
						token: Config.SYSTEM_TOKEN,
					},
				)
			} catch (error) {
				error
			}
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
