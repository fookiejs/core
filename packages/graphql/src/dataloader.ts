import { Model } from "@fookiejs/core"

export type BatchLoadFn<TKey, TValue> = (keys: TKey[]) => Promise<TValue[]>

export interface CacheStrategy {
	get(key: string): any | undefined
	set(key: string, value: any): void
	clear(): void
	delete(key: string): void
}

export class MapCache implements CacheStrategy {
	private cache = new Map<string, any>()

	get(key: string) {
		return this.cache.get(key)
	}

	set(key: string, value: any) {
		this.cache.set(key, value)
	}

	clear() {
		this.cache.clear()
	}

	delete(key: string) {
		this.cache.delete(key)
	}
}

export class DataLoader<TKey = string, TValue = any> {
	private batchLoadFn: BatchLoadFn<TKey, TValue>
	private cache: CacheStrategy
	private queue: TKey[] = []
	private loading = false
	private batchScheduled = false
	private options: DataLoaderOptions<TKey, TValue>

	constructor(
		batchLoadFn: BatchLoadFn<TKey, TValue>,
		options: Partial<DataLoaderOptions<TKey, TValue>> = {},
	) {
		this.batchLoadFn = batchLoadFn
		this.options = {
			cache: new MapCache(),
			maxBatchSize: 1000,
			batchScheduleMs: 0,
			...options,
		}
		this.cache = this.options.cache
	}

	async load(key: TKey): Promise<TValue> {
		const stringKey = this.getStringKey(key)
		const cachedValue = this.cache.get(stringKey)
		if (cachedValue !== undefined) return cachedValue

		this.queue.push(key)

		if (!this.loading) {
			this.loading = true
			if (this.options.batchScheduleMs > 0) {
				if (!this.batchScheduled) {
					this.batchScheduled = true
					await this.dispatchQueue()
				}
			}
		}

		return this.cache.get(key)
	}

	private async dispatchQueue() {
		const keys = [...new Set(this.queue)]
		this.queue = []

		try {
			const values = await this.batchLoadFn(keys)
			keys.forEach((key, index) => {
				this.cache.set(key, values[index])
			})
		} finally {
			this.loading = false
		}
	}
}

export interface FookieModel {
	constructor: {
		read: (query: any, options: any) => Promise<any>
	}
}

export class FookieDataLoader {
	private loaders: Map<string, any> = new Map()
	private batchLoadFn: (model: FookieModel, ids: string[]) => Promise<any[]>

	constructor(batchLoadFn: (model: FookieModel, ids: string[]) => Promise<any[]>) {
		this.batchLoadFn = batchLoadFn
	}

	getLoader(modelName: string, model: FookieModel): DataLoader {
		if (!this.loaders.has(modelName)) {
			this.loaders.set(
				modelName,
				new DataLoader((ids: string[]) => {
					return this.batchLoadFn(model, ids)
				}),
			)
		}
		return this.loaders.get(modelName)
	}
}
