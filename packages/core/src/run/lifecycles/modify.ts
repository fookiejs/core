import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { Model } from "../../model/model.ts"
import { Method } from "../../method/method.ts"
import { after } from "../binds/after.ts"
import { before } from "../binds/before.ts"
import { Lifecycle } from "../lifecycle.ts"

const modify = async function (payload: Payload<Model, Method>): Promise<void> {
	const modifies = [
		...(before[payload.method]?.[Lifecycle.MODIFY] || []),
		...(payload.model.binds()[payload.method]?.[Lifecycle.MODIFY] || []),
		...(after[payload.method]?.[Lifecycle.MODIFY] || []),
	]

	using _span = DisposableSpan.add(`modify`)

	for (const modify of modifies) {
		using _modifySpan = DisposableSpan.add(modify.key)
		await modify.execute(payload)
	}
}
export default modify
