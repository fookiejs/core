import { Method } from "./method"
import { Model, QueryType } from "./model/model"
import { Options } from "./option"
import { State } from "./state"

export type ConstructorOf<T extends Model> = T extends { constructor: infer C }
    ? C & typeof Model
    : never

export type Payload<T extends Model, M extends Method> = {
    method: M
    options: Options
    model: ConstructorOf<T>
    query: QueryType<T>
    body: M extends Method.CREATE ? T : Partial<T>
    runId: string
    state: State
}
