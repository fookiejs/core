import { after } from "../../mixin/binds/after.ts"
import { before } from "../../mixin/binds/before.ts"
import type { Payload } from "../../payload.ts"
import type { Model } from "../../model/model.ts"
import type { Method } from "../../method.ts"
import type { MethodResponse } from "../../response.ts"

export default async function filter<T extends Model, M extends Method>(
	payload: Payload<T, M>,
	response: MethodResponse<T>[M],
) {
	const filters = [
		...(before[payload.method]!.filter || []),
		...(payload.model.binds()![payload.method]!.filter || []),
		...(after[payload.method]!.filter || []),
	]

	for (const filter of filters) {
		await filter.execute(payload, response)
	}
}
