import { BaseClass } from "./base-class"
import { FookieError } from "./error"
import { Model } from "./model/model"
import { Payload } from "./payload"

export class PreRule<ModelClass extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<ModelClass>, error?: FookieError) => Promise<boolean>
}

export class Modify<ModelClass extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<ModelClass>) => Promise<void>
}

export class Rule<ModelClass extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<ModelClass>, error?: FookieError) => Promise<boolean>
}

export class Role<ModelClass extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<ModelClass>, error?: FookieError) => Promise<boolean>
}

export class Filter<ModelClass extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<ModelClass>, response: any) => Promise<void>
}

export class Effect<ModelClass extends Model> extends BaseClass {
    key: string
    execute: (payload: Payload<ModelClass>, cloneResponse: any) => Promise<void>
}
