// Model tipi tanımla
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

	getLoader(modelName: string, model: FookieModel) {
		console.log("getLoader çağrıldı - modelName:", modelName, "model:", model)
		if (!this.loaders.has(modelName)) {
			console.log("Yeni DataLoader oluşturuluyor:", modelName)
			this.loaders.set(
				modelName,
				new DataLoader((ids: string[]) => {
					console.log("DataLoader batch fonksiyonu çağrıldı - ids:", ids)
					return this.batchLoadFn(model, ids)
				}),
			)
		}
		return this.loaders.get(modelName)
	}
}

// DataLoader sınıfı
class DataLoader {
	private batchLoadFn: (keys: string[]) => Promise<any[]>
	private cache: Map<string, any> = new Map()
	private queue: string[] = []
	private loading: boolean = false

	constructor(batchLoadFn: (keys: string[]) => Promise<any[]>) {
		this.batchLoadFn = batchLoadFn
	}

	async load(key: string): Promise<any> {
		if (this.cache.has(key)) {
			return this.cache.get(key)
		}

		this.queue.push(key)
		if (!this.loading) {
			this.loading = true
			await this.dispatchQueue()
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
