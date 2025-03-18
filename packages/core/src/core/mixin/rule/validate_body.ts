import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
import { Rule } from "../../lifecycle-function.ts"
import { FookieError } from "../../error.ts"

export default Rule.create({
	key: "validate_body",
	execute: async function (payload) {
		let flag = true
		const error = FookieError.create({
			message: "validate_body",
			validationErrors: {},
			name: "validate_body",
		})
		for (const field_name in payload.body) {
			const field = (payload.model.schema() as Record<string, any>)[field_name]
			if (lodash.isArray(field.validators)) {
				for (const validator of field.validators) {
					const value = (payload.body as Record<string, any>)[field_name]
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
