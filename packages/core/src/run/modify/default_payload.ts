import { Rule } from "../lifecycle-function.ts"
import { v4 } from "uuid"
import * as lodash from "lodash"

export default Rule.create({
	key: "defalut_payload",
	execute: async function (payload) {
		const newPayload = lodash.merge(payload, {
			options: {},
			body: {},
			query: {
				attributes: [],
			},
			runId: "run:" + v4().replace("-", ""),
		})

		if (!lodash.has(newPayload.query, "filter")) {
			newPayload.query.filter = {}
		}

		for (const key in newPayload) {
			payload[key] = newPayload[key]
		}

		if (!lodash.has(payload.query, "offset")) {
			payload.query.offset = 0
		}
		if (!lodash.has(payload.query, "limit")) {
			payload.query.limit = Infinity
		}

		if (!lodash.has(payload.query, "orderBy")) {
			payload.query.orderBy = {}
		}

		if ((payload.query.attributes || []).length == 0) {
			payload.query.attributes = lodash.keys(payload.model.schema())
		}
		return true
	},
})
