import { globalEffects } from "../../mixin/index.ts"
import type { Payload } from "../../payload.ts"

import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
import type { MethodResponse } from "../../response.ts"
import type { Model } from "../../model/model.ts"
import type { Method } from "../../method.ts"
import type { Effect } from "@fookiejs/core/src/core/lifecycle-function.ts"

export default async function globalEffect<T extends Model, M extends Method>(
	payload: Payload<T, M>,
	response: MethodResponse<T>[M],
): Promise<void> {
	const promises = lodash.reverse(globalEffects).map(async (effect: Effect) => {
		await effect.execute(payload, response)
	})

	await Promise.all(promises)
}
