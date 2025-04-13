import pre_rule from "./lifecycles/pre-rule.ts"
import modify from "./lifecycles/modify.ts"
import role from "./lifecycles/role.ts"
import rule from "./lifecycles/rule.ts"
import effect from "./lifecycles/effect.ts"
import filter from "./lifecycles/filter.ts"
import globalEffect from "./lifecycles/global_effect.ts"
import { FookieError } from "../error/error.ts"
import { Model } from "../model/model.ts"
import type { QueryType } from "../model/model.ts"
import { Method } from "../method/method.ts"
import type { MethodResponse } from "../run/response.ts"
import { DisposableSpan } from "../otel/index.ts"
import preModify from "./lifecycles/pre-modify.ts"
import method from "./lifecycles/method.ts"
import { v4 as uuidv4 } from "uuid"
import { Options } from "../payload/option.ts"
import { State } from "../payload/state.ts"
import { ModelConstructor, Payload } from "../payload/payload.ts"

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

	using _span = DisposableSpan.add(`run:${modelName}:${payload.method}`)

	if (await pre_rule(payload)) {
		await preModify(payload)
		if (await role(payload)) {
			await modify(payload)
			if (await rule(payload)) {
				using _methodSpan = DisposableSpan.add("method")
				const response = await method(payload, dbMethod)
				await filter(payload, response)
				await effect(payload, response)
				await globalEffect(payload, response)
				return response
			}
		}
	}

	throw FookieError.create({
		message: `Lifecycle execution failed.`,
		status: 400,
		code: "LIFECYCLE_FAILURE",
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
			body: {},
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
			body: {},
		})
		return runLifecycle(payload, method)
	}
}
