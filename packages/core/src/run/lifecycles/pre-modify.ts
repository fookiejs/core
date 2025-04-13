import { globalPreModifies } from "../../mixin/binds/global.ts"
import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { Model } from "../../model/model.ts"
import { Method } from "../../method/method.ts"

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
