import type { Options } from "../option.ts"
import type { ModelConstructor, Payload } from "../payload.ts"
import * as lodash from "lodash"
import pre_rule from "./lifecycles/pre-rule.ts"
import modify from "./lifecycles/modify.ts"
import role from "./lifecycles/role.ts"
import rule from "./lifecycles/rule.ts"
import effect from "./lifecycles/effect.ts"
import filter from "./lifecycles/filter.ts"
import globalEffect from "./lifecycles/global_effect.ts"
import { FookieError } from "../error.ts"
import { plainToInstance } from "class-transformer"
import type { Model, QueryType } from "../model/model.ts"
import { Method } from "../method.ts"
import type { MethodResponse } from "../response.ts"
import { DisposableSpan } from "../../otel/index.ts"
import preModify from "./lifecycles/pre-modify.ts"
import { v4 as uuidv4 } from "uuid"
import { State } from "../state.ts"

function createPayload<T extends Model, M extends Method>(
	payloadInput: Omit<Payload<T, M>, "runId" | "state" | "model"> & { model: typeof Model },
): Payload<T, M> {
	return {
		...(payloadInput as Omit<Payload<T, M>, "runId" | "state" | "model">),
		model: payloadInput.model as ModelConstructor<T>,
		runId: uuidv4(),
		state: new State(),
	}
}

async function runLifecycle<T extends Model, M extends Method>(
	payload: Payload<T, M>,
	dbMethod: (payload: Payload<T, M>) => Promise<MethodResponse<T>[M]>,
) {
	const modelName = payload.model.getName()

	using _span = new DisposableSpan(`run:${modelName}:${payload.method}`)

	if (await pre_rule(payload)) {
		await preModify(payload)
		if (await role(payload)) {
			await modify(payload)
			if (await rule(payload)) {
				using _ruleSpan = DisposableSpan.add("method")
				const response = plainToInstance(
					payload.model,
					lodash.isString(payload.state.cachedResponse)
						? JSON.parse(payload.state.cachedResponse!)
						: await dbMethod(payload),
				) as MethodResponse<T>[M]
				await filter(payload, response)
				await effect(payload, response)
				await globalEffect(payload, response)
				return response
			}
		}
	}

	throw FookieError.create({
		validationErrors: {},
		message: "Lifecycle execution failed or was rejected.",
		name: "LifecycleError",
	})
}

export function createRun<T extends Model>(
	method: (payload: Payload<T, Method.CREATE>) => Promise<T>,
) {
	return async function (this: typeof Model, body: T, options: Options = {}) {
		const payload = createPayload<T, Method.CREATE>({
			method: Method.CREATE,
			body,
			options,
			model: this,
			query: {
				limit: Infinity,
				offset: 0,
				attributes: [],
				filter: {},
				orderBy: {},
			},
		})
		return runLifecycle(payload, method)
	}
}

export function readRun<T extends Model>(
	method: (payload: Payload<T, Method.READ>) => Promise<T[]>,
) {
	return async function (
		this: typeof Model,
		query: QueryType<T>,
		options: Options = {},
	) {
		const payload = createPayload<T, Method.READ>({
			method: Method.READ,
			query,
			options,
			model: this,
			body: {} as Partial<T>,
		})
		return runLifecycle(payload, method)
	}
}

export function updateRun<T extends Model>(
	method: (payload: Payload<T, Method.UPDATE>) => Promise<string[]>,
) {
	return async function (
		this: typeof Model,
		query: QueryType<T>,
		body: Partial<T>,
		options: Options = {},
	) {
		const payload = createPayload<T, Method.UPDATE>({
			method: Method.UPDATE,
			query,
			body,
			options,
			model: this,
		})
		return runLifecycle(payload, method)
	}
}

export function deleteRun<T extends Model>(
	method: (payload: Payload<T, Method.DELETE>) => Promise<string[]>,
) {
	return async function (
		this: typeof Model,
		query: QueryType<T>,
		options: Options = {},
	) {
		const payload = createPayload<T, Method.DELETE>({
			method: Method.DELETE,
			query,
			options,
			model: this,
			body: {} as Partial<T>,
		})
		return runLifecycle(payload, method)
	}
}
