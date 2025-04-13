import { Rule } from "../../lifecycle-function/lifecycle-function.ts"
import * as lodash from "lodash"

export default Rule.create({
	key: "validate_payload",
	execute: async function (payload) {
		if (lodash.has(payload, "options") && !lodash.isObject(payload.options)) {
			return false
		}

		if (
			lodash.has(payload.options, "token") &&
			!lodash.isNil(payload.options.token) &&
			!(
				lodash.isString(payload.options.token) ||
				lodash.isSymbol(payload.options.token)
			)
		) {
			return false
		}

		if (lodash.has(payload, "body") && !lodash.isObject(payload.body)) {
			return false
		}

		if (lodash.has(payload, "query") && !lodash.isObject(payload.query)) {
			return false
		}

		const avaible_keys = [
			"state",
			"method",
			"model",
			"options",
			"body",
			"query",
			"runId",
		]

		return lodash.without(lodash.keys(payload), ...avaible_keys).length === 0
	},
})
