import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
import { Rule } from "../../lifecycle-function.ts"
import type { Model } from "../../model/model.ts"
import type { Method } from "../../method.ts"

export default Rule.create<Model, Method>({
	key: "check_type",
	execute: async function (payload) {
		for (const field in payload.body) {
			const type = (payload.model.schema() as Record<string, any>)[field].type

			if (
				!lodash.isNull((payload.body as Record<string, any>)[field]) &&
				!type.validate((payload.body as Record<string, any>)[field])
			) {
				return false
			}
		}
		return true
	},
})
