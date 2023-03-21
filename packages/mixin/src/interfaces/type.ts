import { Method } from "@fookie/method"
import { FieldInterface, LifecycleFunction } from "@fookie/core"

export interface MixinInterface {
    schema?: {
        [key: string]: FieldInterface | string | number
    }
    bind?: {
        [ls in Method]?: {
            preRule?: LifecycleFunction[]
            modify?: LifecycleFunction[]
            role?: LifecycleFunction[]
            rule?: LifecycleFunction[]
            filter?: LifecycleFunction[]
            effect?: LifecycleFunction[]
            accept?: {
                [key: string]: {
                    modify?: LifecycleFunction[]
                    rule?: LifecycleFunction[]
                }
            }
            reject?: {
                [key: string]: {
                    modify?: LifecycleFunction[]
                    rule?: LifecycleFunction[]
                }
            }
        }
    }
}
