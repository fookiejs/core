import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { Model } from "../../model/model.ts"
import { Method } from "../../method/method.ts"
import { FookieError } from "../../error/error.ts"
import { globalRules } from "../binds/global.ts"

const preRule = async function (
	payload: Payload<Model, Method>,
): Promise<boolean> {
	using _preRuleSpan = DisposableSpan.add(`preRule`)

	for (const rule of globalRules) {
		using _ruleSpan = DisposableSpan.add(rule.key)

		const res = await rule.execute(payload)
		if (res !== true) {
			throw FookieError.create({
				message: `Pre-rule ${rule.key} failed.`,
				code: "PRE_RULE",
				status: 400,
			})
		}
	}
	return true
}

export default preRule
