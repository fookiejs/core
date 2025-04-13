import { Method } from "../../method/method.ts"
import { after } from "../../mixin/binds/after.ts"
import { before } from "../../mixin/binds/before.ts"
import { Model } from "../../model/model.ts"
import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { MethodResponse } from "../response.ts"

export default async function effect<T extends Model, M extends Method>(
	payload: Payload<T, M>,
	response: MethodResponse<T>[M],
) {
	const effects = [
		...(before[payload.method]!.effect || []),
		...(payload.model.binds()![payload.method]!.effect || []),
		...(after[payload.method]!.effect || []),
	]
	using _span = DisposableSpan.add(`effect`)

	const promises = effects.map(async (effect) => {
		using _effectSpan = new DisposableSpan(effect.key)
		await effect.execute(payload, response)
	})

	await Promise.all(promises)
}
