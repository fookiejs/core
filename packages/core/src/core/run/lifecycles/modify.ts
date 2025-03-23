import { after } from "../../mixin/binds/after.ts"
import { before } from "../../mixin/binds/before.ts"
import type { Payload } from "../../payload.ts"
import type { Method } from "../../method.ts"
import type { Model } from "../../model/model.ts"
import { DisposableSpan } from "../../../otel/index.ts"

const modify = async function (payload: Payload<Model, Method>): Promise<void> {
	const modifies = [
		...(before[payload.method]?.modify || []),
		...(payload.model.binds()[payload.method]?.modify || []),
		...(after[payload.method]?.modify || []),
	]

	using _span = DisposableSpan.add(`modify`)

	for (const modify of modifies) {
		using _modifySpan = DisposableSpan.add(modify.key)
		await modify.execute(payload)
	}
}
export default modify
