import type { Method } from "./method.ts"
import type { Model } from "./model/model.ts"
import type { Payload } from "./payload.ts"
import { Type } from "./type.ts"

export class Database {
	key!: string
	connect!: () => Promise<void>
	disconnect!: () => Promise<void>
	primaryKeyType!: Type
	modify!: <T extends Model>(
		model: typeof Model,
	) => {
		create: (payload: Payload<T, Method.CREATE>) => Promise<T>
		read: (payload: Payload<T, Method.READ>) => Promise<T[]>
		update: (payload: Payload<T, Method.UPDATE>) => Promise<boolean>
		delete: (payload: Payload<T, Method.DELETE>) => Promise<boolean>
	}

	static create(data: Database): Database {
		const instance = new Database()
		return Object.assign(instance, data)
	}
}
