const queue: any[] = []
import { FieldInterface, ModelInterface } from "../declerations"
import * as lodash from "lodash"
import { model } from "../generators"

export function Model(_model: Partial<ModelInterface>) {
    return function (target: Function) {
        _model.name = lodash.lowerCase(target.name)
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
