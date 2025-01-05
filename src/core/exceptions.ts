import { BaseClass } from "./base-class"
import { Modify, Role, Rule } from "./lifecycle"
import { Model } from "./model"

export class Exception<Entity extends Model> extends BaseClass {
    role: Role<Entity>
    execute: Modify<Entity> | Rule<Entity>
}
