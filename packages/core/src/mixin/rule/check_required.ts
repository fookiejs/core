import { Rule } from "../../lifecycle-function/lifecycle-function.ts"
import { defaults } from "../../defaults/index.ts"
import { Utils } from "../../utils/util.ts"

export default Rule.create({
	key: "check_required",
	execute: async function (payload) {
		const search = [null, undefined]
		const keys = payload.method == "create" ? Utils.keys(payload.model.schema()) : Utils.keys(payload.body)
		for (const key of keys) {
			if (
				(payload.model.schema())[key].features.includes(
					defaults.feature.required,
				)
			) {
				if (search.includes(payload.body[key])) {
					return false
				}
			}
		}
		return true
	},
})
