import { Rule } from "../../lifecycle-function/lifecycle-function.ts"
import { Field } from "../../field/field.ts"
import { Model } from "../../model/model.ts"
import { Method } from "../../method/method.ts"
import { Utils } from "../../utils/util.ts"

export default Rule.create<Model, Method.CREATE | Method.UPDATE>({
	key: "has_entity",
	execute: async function (
		payload,
	) {
		const schema = payload.model.schema()

		for (const key in payload.body) {
			if (Utils.has(schema, key)) {
				continue
			}
			const field = schema[key] as Field

			if (!field.relation) {
				continue
			}

			if (payload.model.database().key === field.relation.database().key) {
				continue
			}

			const entitiesFromDifferentDB = await field.relation.read({
				filter: {
					id: {
						equals: payload.body[key],
					},
				},
				limit: 1,
			}, {
				token: payload.options.token,
			})

			if (entitiesFromDifferentDB.length === 0) {
				return false
			}
		}

		return true
	},
})
