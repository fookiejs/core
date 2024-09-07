import { Method, Model, ModelTypeOutput, QueryType } from "../exports"
import { Options } from "./option"
import { SchemaType } from "./schema"
import { State } from "./state"

export class Payload<ModelClass extends Model> {
    query: QueryType<ModelClass>
    body: ModelClass
    method: Method
    model: ModelTypeOutput
    schema: SchemaType<ModelClass>
    options: Options
    state: State
    fieldName: string
    modelClass: typeof Model
}
