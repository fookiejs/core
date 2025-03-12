import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function"
import { FookieError } from "../../error"

export default Rule.new({
    key: "validate_body",
    execute: async function (payload) {
        let flag = true
        const error = FookieError.new({
            description: "validate_body",
            validationErrors: {},
            key: "validate_body",
        })
        for (const field_name in payload.body) {
            const field = payload.model.schema()[field_name]
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
        if (!flag) {
            throw error
        }

        return true
    },
})
