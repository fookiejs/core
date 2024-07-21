import { BaseClass } from "./base-class"
import { Model } from "./model/model"
import { Payload } from "./payload"

export class LifecycleFunction<ModelClass extends Model, ResponseType> extends BaseClass {
    key: string
    execute: (payload: Payload<ModelClass, ResponseType>) => unknown
}
