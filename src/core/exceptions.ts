import { BaseClass } from "./base-class"
import { Modify, Role, Rule } from "./lifecycle"
import { Model } from "./model"

export class Exception<Entity extends Model> extends BaseClass {
    type: (typeof ExceptionType)[keyof typeof ExceptionType]
    role: Role<Entity>
    execute: Modify<Entity> | Rule<Entity>
}

export const ExceptionType = {
    ACCEPT: Symbol("ACCEPT"),
    REJECT: Symbol("REJECT"),
} as const
