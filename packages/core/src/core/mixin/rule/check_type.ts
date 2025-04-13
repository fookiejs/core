import { Rule } from "../../lifecycle-function.ts"
import type { Model } from "../../model/model.ts"
import type { Method } from "../../method.ts"
import * as lodash from "lodash"

export default Rule.create<Model, Method>({
	key: "check_type",
	execute: async function (payload) {
		for (const field in payload.body) {
			const type = (payload.model.schema())[field].type

			if (
				!lodash.isNull(payload.body[field]) &&
				!type.validate(payload.body[field])
			) {
				return false
			}
		}
		return true
	},
})
