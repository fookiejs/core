import { FookieError } from "../../error/error.ts"
import { before } from "../binds/before.ts"
import { after } from "../binds/after.ts"
import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { Model } from "../../model/model.ts"
import { Method } from "../../method/method.ts"
import { Lifecycle } from "../lifecycle.ts"

const rule = async function (
	payload: Payload<Model, Method>,
): Promise<boolean> {
	const rules = [
		...before[payload.method]![Lifecycle.RULE]!,
		...payload.model.binds()![payload.method]![Lifecycle.RULE]!,
		...after[payload.method]![Lifecycle.RULE]!,
	]
	using _span = DisposableSpan.add(`rule`)

	for (const rule of rules) {
		using _ruleSpan = new DisposableSpan(rule.key)

		const res = await rule.execute(payload)

		if (res !== true) {
			throw FookieError.create({
				message: `Rule ${rule.key} failed.`,
				code: "RULE",
				status: 400,
			})
		}
	}
	return true
}

export default rule
