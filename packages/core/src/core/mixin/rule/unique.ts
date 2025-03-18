import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
import { Rule } from "../../lifecycle-function.ts"
import { Config } from "../../config.ts"
import { defaults } from "../../../defaults/index.ts"

export default Rule.create({
	key: "unique",
	execute: async function (payload) {
		const trash_old = payload.method === "create" ? 0 : 1
		const fields = lodash.keys(payload.body)
		for (const field of fields) {
			if (
				(payload.model.schema() as Record<string, any>)[
					field
				].features.includes(defaults.feature.unique)
			) {
				const res = await payload.model.read(
					{
						filter: {
							[field]: { equals: (payload.body as Record<string, any>)[field] },
						},
					},
					{ sub: Config.SYSTEM_TOKEN },
				)

				if (Array.isArray(res) && res.length > trash_old) {
					return false
				}
			}
		}
		return true
	},
})
