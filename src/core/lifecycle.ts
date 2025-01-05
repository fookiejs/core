import { BaseClass } from "./base-class"
import { Model } from "./model"
import { Payload } from "./payload"

export class Rule<Entity extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<Entity>) => Promise<boolean>
}

export class Role<Entity extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<Entity>) => Promise<boolean>
}

export class Modify<Entity extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<Entity>) => Promise<void>
}

export class Effect<Entity extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<Entity>) => Promise<void>
}

export class Filter<Entity extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<Entity>) => Promise<void>
}

export const Lifecycle = {
    RULE: Symbol(),
    ROLE: Symbol(),
    MODIFY: Symbol(),
    EFFECT: Symbol(),
    FILTER: Symbol(),
}
