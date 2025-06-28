import { Method } from "../../method/method.ts"
import { before } from "../binds/before.ts"
import { after } from "../binds/after.ts"
import { Model } from "../../model/model.ts"
import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { MethodResponse } from "../response.ts"
import { Lifecycle } from "../lifecycle.ts"

export default async function effect<T extends Model, M extends Method>(
	payload: Payload<T, M>,
	response: MethodResponse<T>[M],
) {
	const effects = [
		...(before[payload.method]![Lifecycle.EFFECT] || []),
		...(payload.model.binds()![payload.method]![Lifecycle.EFFECT] || []),
		...(after[payload.method]![Lifecycle.EFFECT] || []),
	]
	using _span = DisposableSpan.add(`effect`)

	const promises = effects.map(async (effect) => {
		using _effectSpan = new DisposableSpan(effect.key)
		await effect.execute(payload, response)
	})

	await Promise.all(promises)
}
