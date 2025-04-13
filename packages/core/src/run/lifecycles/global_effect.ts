import * as lodash from "lodash"
import { globalEffects } from "../../mixin/index.ts"
import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { Model } from "../../model/model.ts"
import { Method } from "../../method/method.ts"
import { Effect } from "../../lifecycle-function/lifecycle-function.ts"
import { MethodResponse } from "../response.ts"

export default async function globalEffect<T extends Model, M extends Method>(
	payload: Payload<T, M>,
	response: MethodResponse<T>[M],
): Promise<void> {
	using _span = DisposableSpan.add(`globalEffect`)
	const promises = lodash.reverse(globalEffects).map(async (effect: Effect) => {
		using _effectSpan = DisposableSpan.add(effect.key)
		await effect.execute(payload, response)
	})

	await Promise.all(promises)
}
