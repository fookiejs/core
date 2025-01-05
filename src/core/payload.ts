import { Model } from "./model"
import { Methods } from "./method"
import { Query } from "./query"
import { BaseClass } from "./base-class"

export class Payload<Entity extends Model> extends BaseClass {
    model: new () => Entity
    method:
        | typeof Methods.CREATE
        | typeof Methods.READ
        | typeof Methods.UPDATE
        | typeof Methods.DELETE
    body: Entity
    query: Query<Entity>
    options: {
        token: string
    }
}
