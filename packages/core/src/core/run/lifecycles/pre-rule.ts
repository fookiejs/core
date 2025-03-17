import type { Payload } from "../../payload.ts"
import { FookieError } from "../../error.ts"
import { globalRules } from "../../mixin/binds/global.ts"
import type { Method } from "../../method.ts"
import type { Model } from "../../model/model.ts"

const preRule = async function (
	payload: Payload<Model, Method>,
): Promise<boolean> {
	for (const rule of globalRules) {
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
