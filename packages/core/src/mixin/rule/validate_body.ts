import { Rule } from "../../lifecycle-function/lifecycle-function.ts"
import { FookieError } from "../../error/error.ts"
import * as lodash from "lodash"

export default Rule.create({
	key: "validate_body",
	execute: async function (payload) {
		const validationErrors: Record<string, string[]> = {}
		for (const field_name in payload.body) {
			const field = (payload.model.schema())[field_name]
			if (lodash.isArray(field.validators)) {
				for (const validator of field.validators) {
					const value = payload.body[field_name]
					const validationResult = await validator(value)
					if (typeof validationResult === "string") {
						if (!validationErrors[field_name]) {
							validationErrors[field_name] = []
						}
						validationErrors[field_name].push(validationResult)
					}
				}
			}
		}
		if (Object.keys(validationErrors).length > 0) {
			throw FookieError.create({
				message: "Validation failed.",
				validationErrors: validationErrors,
				status: 400,
				code: "VALIDATION_ERROR",
			})
		}

		return true
	},
})
