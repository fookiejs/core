import * as lodash from "npm:lodash@^4.17.21"
import { Rule } from "../../lifecycle-function.ts"

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
