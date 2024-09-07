import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"

export default Rule.new({
    key: "validate_body",
    execute: async function (payload, error) {
        let flag = true
        for (const field_name in payload.body) {
            const field = payload.modelClass.schema()[field_name]
            if (lodash.isArray(field.validators)) {
                for (const validator of field.validators) {
                    const value = payload.body[field_name]
                    const is_valid = await validator(value)
                    if (!lodash.isBoolean(is_valid)) {
                        flag = false
                        if (!lodash.has(error.validationErrors, field_name)) {
                            error.validationErrors[field_name] = []
                        }
                        error.validationErrors[field_name].push(is_valid)
                    }
                }
            }
        }

        return flag
    },
})
