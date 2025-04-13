import * as lodash from "lodash"
import { Rule } from "../../lifecycle-function/lifecycle-function.ts"

export default Rule.create({
	key: "has_field",
	execute: async function (payload) {
		const body_keys = lodash.keys(payload.body)

		const schema_keys = lodash.keys(payload.model.schema())

		for (const key of body_keys) {
			if (!schema_keys.includes(key)) {
				return false
			}
		}
		return true
	},
})
