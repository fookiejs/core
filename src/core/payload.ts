import { Method, Model, ModelType, QueryType } from "../exports"
import { FookieError } from "./error"
import { Options } from "./option"
import { SchemaType } from "./schema"
import { State } from "./state"

export class Payload<ModelClass extends Model, ResponseType> {
    query: QueryType<ModelClass>
    body: ModelClass
    method: Method
    model: ModelType
    schema: SchemaType<ModelClass>
    options: Options
    response: ResponseType | null
    state: State
    fieldName?: string
    error: FookieError
    modelClass: typeof Model
    methodFunction: (payload: Payload<ModelClass, ResponseType>) => Promise<ResponseType>
}
