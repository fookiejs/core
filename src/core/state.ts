import { LifecycleFunction } from "./lifecycle-function"
import { Model } from "./model/model"

export class State {
    metrics: {
        start: Date
        end?: Date | null
        lifecycle: {
            name: string
            ms: number
        }[]
    }
    test?: boolean
    todo: LifecycleFunction<Model, unknown>[]
}
