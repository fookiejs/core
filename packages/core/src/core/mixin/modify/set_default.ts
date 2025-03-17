import * as lodash from "npm:lodash@^4.17.21"
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
