import { Method } from "./method"
import { Model, QueryType } from "./model/model"
import { Options } from "./option"
import { State } from "./state"

export type ConstructorOf<T extends Model> = T extends { constructor: infer C }
    ? C & typeof Model
    : never

export type Payload<T extends Model = Model, M extends Method | undefined = Method> = {
    runId: string
    options: Options
    state: State
    model: ConstructorOf<T>
} & (M extends Method.READ
    ? { method: Method.READ; query: QueryType<T> }
    : M extends Method.CREATE
      ? { method: Method.CREATE; body: T }
      : M extends Method.UPDATE
        ? { method: Method.UPDATE; query: QueryType<T>; body: Partial<T> }
        : M extends Method.DELETE
          ? { method: Method.DELETE; query: QueryType<T> }
          : { method: Method; query: QueryType<T>; body: Partial<T> })
