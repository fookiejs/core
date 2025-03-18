import { Utils } from "../../../utils/util.ts"
import { Rule } from "../../lifecycle-function.ts"

export default Rule.create({
	key: "has_field",
	execute: async function (payload) {
		const body_keys = Utils.keys(payload.body)

		const schema_keys = Utils.keys(payload.model.schema())
		for (const key of body_keys) {
			if (!schema_keys.includes(key)) {
				return false
			}
		}
		return true
	},
})
