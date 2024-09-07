import { Method, Model, QueryType } from "../exports"
import { Options } from "./option"

import { State } from "./state"

export class Payload<ModelClass extends Model> {
    query: QueryType<ModelClass>
    body: ModelClass
    method: Method
    options: Options
    state: State
    fieldName: string
    modelClass: typeof Model
}
