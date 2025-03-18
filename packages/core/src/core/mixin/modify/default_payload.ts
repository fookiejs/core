import { Rule } from "../../lifecycle-function.ts"
import { v4 } from "uuid"
import * as lodash from "npm:lodash-es@^4.17.21"
import { Utils } from "@fookiejs/core/src/utils/util.ts"

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
			;(payload as Record<string, any>)[key] = (
				newPayload as Record<string, any>
			)[key]
		}

		if (!Utils.has(payload.query, "offset")) {
			payload.query.offset = 0
		}
		if (!Utils.has(payload.query, "limit")) {
			payload.query.limit = Infinity
		}

		if ((payload.query.attributes || []).length == 0) {
			payload.query.attributes = Utils.keys(payload.model.schema())
		}
		return true
	},
})
