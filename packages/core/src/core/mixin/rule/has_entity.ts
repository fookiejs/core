import { Config } from "../../config.ts"
import { Rule } from "../../lifecycle-function.ts"

import * as lodash from "npm:lodash@^4.17.21"
import type { Method } from "../../method.ts"
import type { Model } from "../../model/model.ts"

export default Rule.create<Model, Method>({
	key: "has_entity",
	execute: async function (payload) {
		for (const key of Object.keys(payload.body) as (keyof Model)[]) {
			if (lodash.has(payload.model.schema()[key], "relation")) {
				payload.model.schema()[key]
				const res = await payload.model.schema()[key].relation!.read(
					{
						filter: {
							id: { equals: payload.body[key] },
						},
					},
					{
						sub: Config.SYSTEM_TOKEN,
					},
				)

				if (Array.isArray(res) && res.length === 0) {
					return false
				}
			}
		}
		return true
	},
})
