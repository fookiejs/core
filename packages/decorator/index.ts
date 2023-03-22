import * as lodash from "lodash"
import { model } from "../core"
import { ModelInterface, FieldInterface } from "../../types"

const queue: any[] = []

export function Model(_model: Partial<ModelInterface>) {
    return function (target: any) {
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
    return function (target: any, key: any) {
        queue.push({ key, field })
    }
}
