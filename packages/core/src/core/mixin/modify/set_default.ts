import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
import { Modify } from "../../lifecycle-function.ts"

export default Modify.create({
	key: "set_default",
	execute: async function (payload) {
		const pureDefaults = lodash.mapValues(
			payload.model.schema(),
			function (o: any) {
				return o.default
			},
		)

		const defaults = lodash.pickBy(pureDefaults, function (v: any) {
			return !lodash.isUndefined(v)
		})
		payload.body = lodash.defaults(payload.body, defaults)
	},
})
