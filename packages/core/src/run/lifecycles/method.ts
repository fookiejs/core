import * as lodash from "lodash"
import { plainToInstance } from "class-transformer"
import { FookieError } from "../../error/error.ts"
import { Method } from "../../method/method.ts"
import { Model } from "../../model/model.ts"
import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { MethodResponse } from "../response.ts"

const method = async function <T extends Model, M extends Method>(
	payload: Payload<T, M>,
	dbMethod: (payload: Payload<T, M>) => Promise<MethodResponse<T>[M]>,
): Promise<MethodResponse<T>[M]> {
	using _span = new DisposableSpan(`method:${payload.method}`)
	try {
		const dbResponse = lodash.isString(payload.state.cachedResponse)
			? JSON.parse(payload.state.cachedResponse!)
			: await dbMethod(payload)

		// DELETE and UPDATE return string arrays, don't transform them
		if (payload.method === Method.DELETE || payload.method === Method.UPDATE) {
			return dbResponse as MethodResponse<T>[M]
		}

		// CREATE and READ return Model instances, transform them
		const response = plainToInstance(payload.model, dbResponse) as MethodResponse<T>[M]
		return response
	} catch (error) {
		throw FookieError.create({
			message: error.message,
			code: "METHOD_ERROR",
			status: 400,
		})
	}
}

export default method
