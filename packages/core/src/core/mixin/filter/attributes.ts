import { Filter } from "../../lifecycle-function.ts"
import { Method } from "../../method.ts"
import * as lodash from "npm:lodash-es@^4.17.21"

export default Filter.create({
	key: "attributes",
	execute: async function (payload, response) {
		if (payload.method === Method.READ && Array.isArray(response)) {
			response.forEach((entity, index) => {
				const picked = lodash.pick(entity, payload.query.attributes)
				Object.keys(response[index]).forEach(
					(key) => delete (response[index] as Record<string, any>)[key],
				)
				Object.assign(response[index], picked)
			})
		}

		if (payload.method === Method.CREATE) {
			const picked = lodash.pick(response, payload.query.attributes)
			Object.keys(response).forEach(
				(key) => delete (response as Record<string, any>)[key],
			)

			Object.assign(response, picked)
		}
	},
})
