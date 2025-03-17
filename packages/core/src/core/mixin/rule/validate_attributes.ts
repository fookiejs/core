import * as lodash from "npm:lodash@^4.17.21"
import { Rule } from "../../lifecycle-function.ts"
import { Method } from "../../method.ts"

export default Rule.create({
	key: "validate_attributes",
	execute: async function (payload) {
		if (payload.method !== Method.READ) {
			return true
		}

		const keys = lodash.keys(payload.model.schema()).concat(["id"])
		return (payload.query.attributes || []).every(function (k: string) {
			return keys.includes(k)
		})
	},
})
