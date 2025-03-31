import type { Payload } from "../../payload.ts"
import { globalPreModifies } from "../../mixin/binds/global.ts"
import type { Method } from "../../method.ts"
import type { Model } from "../../model/model.ts"
import { DisposableSpan } from "../../../otel/index.ts"

const preModify = async function (
	payload: Payload<Model, Method>,
): Promise<boolean> {
	using _preRuleSpan = DisposableSpan.add(`preRule`)

	for (const modify of globalPreModifies) {
		using _modifySpan = DisposableSpan.add(modify.key)

		await modify.execute(payload)
	}
	return true
}

export default preModify
