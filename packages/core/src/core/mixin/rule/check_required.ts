import { Rule } from "../../lifecycle-function.ts"
import { defaults } from "../../../defaults/index.ts"
import { Utils } from "@fookiejs/core/src/utils/util.ts"

export default Rule.create({
	key: "check_required",
	execute: async function (payload) {
		const search = [null, undefined]
		const keys = payload.method == "create" ? Utils.keys(payload.model.schema()) : Utils.keys(payload.body)
		for (const key of keys) {
			if (
				(payload.model.schema() as Record<string, any>)[key].features.includes(
					defaults.feature.required,
				)
			) {
				if (search.includes((payload.body as Record<string, any>)[key])) {
					return false
				}
			}
		}
		return true
	},
})
