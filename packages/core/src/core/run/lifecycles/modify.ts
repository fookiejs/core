import { after } from "../../mixin/binds/after.ts"
import { before } from "../../mixin/binds/before.ts"
import type { Payload } from "../../payload.ts"
import type { Method } from "../../method.ts"
import type { Model } from "../../model/model.ts"

const modify = async function (payload: Payload<Model, Method>): Promise<void> {
	const modifies = [
		...(before[payload.method]?.modify || []),
		...(payload.model.binds()[payload.method]?.modify || []),
		...(after[payload.method]?.modify || []),
	]

	for (const modify of modifies) {
		try {
			await modify.execute(payload)
		} catch (error) {
			error
		}
	}
}
export default modify
