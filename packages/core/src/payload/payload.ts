import type { Method } from "../method/method.ts"
import type { Model, QueryType } from "../model/model.ts"
import type { Options } from "./option.ts"
import type { State } from "./state.ts"

export type ModelConstructor<T extends Model> = typeof Model & (new (...args: any[]) => T)

export type PayloadBody<T extends Model, M extends Method> = M extends Method.CREATE ? T
	: M extends Method.UPDATE ? Partial<T>
	: Partial<T>

export type Payload<T extends Model, M extends Method> = {
	method: M
	options: Options
	model: ModelConstructor<T>
	query: QueryType<T>
	body: PayloadBody<T, M>
	runId: string
	state: State
}
