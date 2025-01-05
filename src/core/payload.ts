import { Model } from "./model"
import { Create, Read, Update, Delete } from "./method"
import { Query } from "./query"

export class Payload {
    model: typeof Model
    method: typeof Create | typeof Read | typeof Update | typeof Delete
    body: any
    query: Query
    options: {
        token: string
    }
}
