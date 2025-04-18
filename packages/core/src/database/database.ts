import { Method } from "../method/method.ts"
import { Model } from "../model/model.ts"
import { Payload } from "../payload/payload.ts"
import { Type } from "../type/type.ts"
export class Database {
	key!: string
	primaryKeyType!: Type
	modify!: <T extends Model>(
		model: typeof Model,
	) => {
		create: (payload: Payload<T, Method.CREATE>) => Promise<T>
		read: (payload: Payload<T, Method.READ>) => Promise<T[]>
		update: (payload: Payload<T, Method.UPDATE>) => Promise<string[]>
		delete: (payload: Payload<T, Method.DELETE>) => Promise<string[]>
	}
	static create(data: Database): Database {
		const instance = new Database()
		return Object.assign(instance, data)
	}
}
