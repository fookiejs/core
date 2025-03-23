import type { Payload } from "../../payload.ts"
import { FookieError } from "../../error.ts"
import { globalRules } from "../../mixin/binds/global.ts"
import type { Method } from "../../method.ts"
import type { Model } from "../../model/model.ts"
import { DisposableSpan } from "../../../otel/index.ts"

const preRule = async function (
	payload: Payload<Model, Method>,
): Promise<boolean> {
	using _preRuleSpan = DisposableSpan.add(`preRule`)

	for (const rule of globalRules) {
		using _ruleSpan = DisposableSpan.add(rule.key)

		const res = await rule.execute(payload)
		if (res !== true) {
			throw FookieError.create({
				message: "pre-rule",
				validationErrors: {},
				name: rule.key,
			})
		}
	}
	return true
}

export default preRule
