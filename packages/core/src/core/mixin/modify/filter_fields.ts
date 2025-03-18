import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
import { Modify } from "../../lifecycle-function.ts"

export default Modify.create({
	key: "filter_fields",
	execute: async function (payload) {
		for (const key of payload.query.attributes || []) {
			const field = (payload.model.schema() as Record<string, any>)[key]

			let show = true

			for (const role of field.read || []) {
				const res = await role.execute(payload)

				show = show && !!res
			}

			if (!show) {
				payload.query.attributes = lodash.pull(payload.query.attributes, key)
			}
		}
	},
})
