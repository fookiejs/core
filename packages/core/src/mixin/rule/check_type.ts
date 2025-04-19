import { Rule } from "../../lifecycle-function/lifecycle-function.ts"
import type { Model } from "../../model/model.ts"
import type { Method } from "../../method/method.ts"
import { Utils } from "../../utils/util.ts"
import * as lodash from "lodash"

export default Rule.create<Model, Method>({
	key: "check_type",
	execute: async function (payload) {
		for (const field in payload.body) {
			const fieldSchema = (payload.model.schema())[field]
			const type = fieldSchema.type
			const value = payload.body[field]

			if (lodash.isNull(value)) continue

			if (fieldSchema.isArray) {
				if (!Utils.isArrayOf(value, (item) => type.validate(item))) {
					return false
				}
			} else if (!type.validate(value)) {
				return false
			}
		}
		return true
	},
})
