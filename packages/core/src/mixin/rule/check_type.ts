import { Rule } from "../../lifecycle-function/lifecycle-function.ts"
import * as lodash from "lodash"
import { CoreTypes } from "../../type/types.ts"
import { Field } from "../../field/field.ts"
import { TypeStandartization } from "../../type/standartization.ts"

export default Rule.create({
	key: "check_type",
	execute: async function (payload) {
		const schema = payload.model.schema()
		const keys = lodash.keys(payload.body)

		for (const key of keys) {
			const field = schema[key] as Field
			const type = field.type as TypeStandartization
			const value = payload.body[key]

			if (lodash.isNull(value)) continue

			if (field.isArray) {
				if (!Array.isArray(value)) {
					return false
				}

				if (value.some((val) => lodash.isNull(val))) {
					return false
				}

				for (const val of value) {
					if (!CoreTypes[type].validate(val)) {
						return false
					}
				}
			} else {
				if (!CoreTypes[type].validate(value)) {
					return false
				}
			}
		}

		return true
	},
})
