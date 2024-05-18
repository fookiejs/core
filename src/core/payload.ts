import { Method, Model, ModelType, QueryType } from "../exports"
import { FookieError } from "./error"
import { Options } from "./option"
import { SchemaType } from "./schema"
import { State } from "./state"

export class Payload<T extends typeof Model, R> {
    query: QueryType<T>
    body: InstanceType<T> | Partial<InstanceType<T>>
    method: Method
    model: Required<ModelType>
    schema: SchemaType<T>
    options: Options
    response: R | null
    state: State
    fieldName?: string
    error: FookieError
    modelClass: T
    methodFunction: (payload: Payload<T, R>) => Promise<R>
}
