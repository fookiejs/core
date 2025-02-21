import { Model } from "./model"
import { Payload } from "./payload"
import { BaseClass } from "./base-class"
import * as Methods from "./method"

export class Database extends BaseClass {
    init!: <T extends typeof Model>(
        model: T,
    ) => {
        [Methods.CREATE]: (payload: Payload<InstanceType<T>>) => Promise<InstanceType<T>>
        [Methods.READ]: (payload: Payload<InstanceType<T>>) => Promise<InstanceType<T>[]>
        [Methods.UPDATE]: (payload: Payload<InstanceType<T>>) => Promise<boolean>
        [Methods.DELETE]: (payload: Payload<InstanceType<T>>) => Promise<boolean>
    }
}
