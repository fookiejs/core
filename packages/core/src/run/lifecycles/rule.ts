import { FookieError } from "../../error/error.ts"
import { after } from "../../mixin/binds/after.ts"
import { before } from "../../mixin/binds/before.ts"
import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { Model } from "../../model/model.ts"
import { Method } from "../../method/method.ts"

const rule = async function (
	payload: Payload<Model, Method>,
): Promise<boolean> {
	const rules = [
		...before[payload.method]!.rule!,
		...payload.model.binds()![payload.method]!.rule!,
		...after[payload.method]!.rule!,
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
