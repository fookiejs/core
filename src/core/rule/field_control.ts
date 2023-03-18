import * as lodash from "lodash"
import { v4 } from "uuid"
import { models, run } from "../.."
import { Delete } from "methods"

const field_control: LifecycleFunction = async function (payload, state) {
    const model = payload.model
    let fields = lodash.keys(payload.body)
    let res = true
    for (let f of fields) {
        const field = model.schema[f]
        const value = payload.body[f]
        if (lodash.isNumber(field.minimum)) {
            res = res && value >= field.minimum
        }

        if (lodash.isNumber(field.maximum)) {
            res = res && value <= field.maximum
        }

        if (lodash.isNumber(field.maximum_size)) {
            res = res && value.length <= field.maximum_size
        }

        if (lodash.isNumber(field.minimum_size)) {
            res = res && value.length >= field.minimum_size
        }
    }
    return res
}

export default field_control
