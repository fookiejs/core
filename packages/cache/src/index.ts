import crypto from "crypto"
import {
    Config,
    Database,
    defaults,
    Effect,
    Field,
    FookieError,
    Method,
    Mixin,
    Model,
    Modify,
    Required,
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
                role: [defaults.lifecycle.system],
            },
            [Method.READ]: {
                role: [defaults.lifecycle.system],
            },
            [Method.UPDATE]: {
                role: [defaults.lifecycle.nobody],
            },
            [Method.DELETE]: {
                role: [defaults.lifecycle.system],
            },
        },
    })
    class FookieCache extends Model {
        @Field.Decorator({
            type: defaults.type.string,
            features: [Required],
        })
        model: string

        @Field.Decorator({
            type: defaults.type.string,
            features: [Required],
        })
        hash: string

        @Field.Decorator({
            type: defaults.type.string,
            features: [Required],
        })
        data: string

        @Field.Decorator({
            type: defaults.type.number,
            features: [Required],
        })
        expiresAt: number
    }

    const isCached = Modify.new({
        key: "isCached",
        execute: async function (payload) {
            const cacheKey = hasher({
                sub: payload.options.sub,
                query: payload.query,
                model: payload.model.name,
            })

            const entries = await FookieCache.read(
                {
                    filter: {
                        hash: { equals: cacheKey },
                        model: { equals: payload.model.name },
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
        Effect.new({
            key: "cacheResponse",
            execute: async (payload, response) => {
                const cacheKey = hasher({
                    sub: payload.options.sub,
                    query: payload.query,
                    model: payload.model.name,
                })

                const expiresAt = Date.now() + ttl

                await FookieCache.create(
                    {
                        model: payload.model.name,
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
        Effect.new({
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
                    model: payload.model.name,
                })

                const expiresAt = Date.now() + ttl

                await FookieCache.create(
                    {
                        model: payload.model.name,
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

    const clearModelCache = Effect.new({
        key: "clearCache",
        execute: async (payload) => {
            await FookieCache.delete(
                {
                    filter: {
                        model: { equals: payload.model.name },
                    },
                },
                {
                    sub: Config.SYSTEM_TOKEN,
                },
            )
        },
    })

    const clearExpiredCache = Effect.new({
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
            return Mixin.new({
                key: "cache",
                binds: {
                    [Method.CREATE]: {
                        effect: [clearModelCache, cacheCreateResponse(ttl), clearExpiredCache],
                    },
                    [Method.READ]: {
                        modify: [isCached],
                        effect: [cacheResponse(ttl), clearExpiredCache],
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
