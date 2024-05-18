import { BaseClass } from "./base-class"
import { Model } from "./model/model"
import { Payload } from "./payload"

export class LifecycleFunction<M extends typeof Model, R> extends BaseClass {
    key: string
    execute: (payload: Payload<M, R>) => unknown
}
