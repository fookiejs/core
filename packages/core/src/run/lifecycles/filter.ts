import { before } from "../binds/before.ts"
import { after } from "../binds/after.ts"
import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { Model } from "../../model/model.ts"
import { Method } from "../../method/method.ts"
import { MethodResponse } from "../response.ts"
import { Lifecycle } from "../lifecycle.ts"

export default async function filter<T extends Model, M extends Method>(
	payload: Payload<T, M>,
	response: MethodResponse<T>[M],
) {
	const filters = [
		...(before[payload.method]![Lifecycle.FILTER] || []),
		...(payload.model.binds()![payload.method]![Lifecycle.FILTER] || []),
		...(after[payload.method]![Lifecycle.FILTER] || []),
	]
	using _span = DisposableSpan.add(`filter`)
	for (const filter of filters) {
		using _filterSpan = DisposableSpan.add(filter.key)
		await filter.execute(payload, response)
	}
}
