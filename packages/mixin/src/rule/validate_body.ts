import * as lodash from "lodash"
import { LifecycleFunction } from "../../../../types"

const validate_body: LifecycleFunction<unknown, any> = async function (payload, state) {
    const model = payload.model
    let flag = true
    for (const field_name in payload.body) {
        const field = model.schema[field_name]
        if (lodash.isArray(field.validators)) {
            for (const validator of field.validators) {
                const value = payload.body[field_name]
                const is_valid = await validator(value)
                if (!is_valid) {
                    flag = false
                    if (!lodash.has(payload.response.validation_error, field_name)) {
                        payload.response.validation_error[field_name] = []
                    }
                    payload.response.validation_error[field_name].push(validator.name)
                }
            }
        }
    }

    return flag
}

export default validate_body
