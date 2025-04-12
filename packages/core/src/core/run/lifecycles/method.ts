import type { Method } from "../../method.ts"
import type { Model } from "../../model/model.ts"
import type { Payload } from "../../payload.ts"
import type { MethodResponse } from "../../response.ts"
import { plainToInstance } from "class-transformer"
import * as lodash from "lodash"
import { DisposableSpan } from "../../../otel/index.ts"
import { FookieError } from "../../error.ts"

const method = async function <T extends Model, M extends Method>(
	payload: Payload<T, M>,
	dbMethod: (payload: Payload<T, M>) => Promise<MethodResponse<T>[M]>,
): Promise<MethodResponse<T>[M]> {
	using _span = new DisposableSpan(`method:${payload.method}`)
	try {
		const response = plainToInstance(
			payload.model,
			lodash.isString(payload.state.cachedResponse)
				? JSON.parse(payload.state.cachedResponse!)
				: await dbMethod(payload),
		) as MethodResponse<T>[M]

		return response
	} catch (error) {
		throw FookieError.create({
			validationErrors: {},
			message: error.message,
			name: "MethodError",
		})
	}
}

export default method
