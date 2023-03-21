const queue: any[] = []
import * as lodash from "lodash"
import { ModelInterface, FieldInterface, model } from "@fookie/core"

export function Model(_model: Partial<ModelInterface>) {
    return function (target: Function) {
        _model.name = lodash.toLower(target.name)
        _model.schema = {}

        while (queue.length > 0) {
            const { key, field } = queue.pop()

            _model.schema[key] = field
        }
        model(_model)
    }
}

export function Field(field: Partial<FieldInterface>) {
    return function (target: any, key: string) {
        queue.push({ key, field })
    }
}
