import { Options } from "../option"
import { Payload, ConstructorOf } from "../payload"
import * as lodash from "lodash"
import pre_rule from "./lifecycles/pre-rule"
import modify from "./lifecycles/modify"
import role from "./lifecycles/role"
import rule from "./lifecycles/rule"
import effect from "./lifecycles/effect"
import filter from "./lifecycles/filter"
import globalEffect from "./lifecycles/global_effect"
import { FookieError } from "../error"
import { plainToInstance } from "class-transformer"
import { Model, QueryType } from "../model/model"
import { Method } from "../method"
import { MethodResponse } from "../response"

function createPayload<T extends Model, M extends Method>(
    payload: Omit<Payload<T, M>, "runId" | "state">,
): Payload<T, M> {
    return {
        ...payload,
        runId: "abc",
        state: {},
    }
}

async function runLifecycle<T extends Model, M extends Method>(
    payload: Payload<T, M>,
    method: (payload: Payload<T, M>) => Promise<MethodResponse<T>[M]>,
) {
    try {
        if (await pre_rule(payload)) {
            await modify(payload)
            if (await role(payload)) {
                if (await rule(payload)) {
                    const response = plainToInstance(
                        payload.model,
                        lodash.isString(payload.state.cachedResponse)
                            ? JSON.parse(payload.state.cachedResponse)
                            : await method(payload),
                    ) as MethodResponse<T>[M]

                    await filter(payload, response)
                    await effect(payload, response)
                    await globalEffect(payload, response)

                    return response
                }
            }
        }
    } catch (error) {
        if (error instanceof FookieError) {
            return error
        }

        if (error instanceof Error) {
            return FookieError.new({
                key: "unknown",
                validationErrors: {},
                description: error.message,
            })
        }
    }

    return FookieError.new({
        key: "unknown",
        validationErrors: {},
        description: "core error",
    })
}

export function createRun<T extends Model>(
    method: (payload: Payload<T, Method.CREATE>) => Promise<T>,
) {
    return async function (this: typeof Model, body: T, options: Options = {}) {
        const payload = createPayload({
            method: Method.CREATE,
            body,
            options,
            model: this as unknown as ConstructorOf<T>,
            query: {
                limit: Infinity,
                offset: 0,
                attributes: [],
                filter: {},
            },
        })
        return runLifecycle(payload, method)
    }
}

export function readRun<T extends Model>(
    method: (payload: Payload<T, Method.READ>) => Promise<T[]>,
) {
    return async function (this: typeof Model, query: QueryType<T>, options: Options = {}) {
        const payload = createPayload({
            method: Method.READ,
            query,
            options,
            model: this as unknown as ConstructorOf<T>,
            body: {},
        })
        return runLifecycle(payload, method)
    }
}

export function updateRun<T extends Model>(
    method: (payload: Payload<T, Method.UPDATE>) => Promise<boolean>,
) {
    return async function (
        this: typeof Model,
        query: QueryType<T>,
        body: Partial<T>,
        options: Options = {},
    ) {
        const payload = createPayload({
            method: Method.UPDATE,
            query,
            body,
            options,
            model: this as unknown as ConstructorOf<T>,
        })
        return runLifecycle(payload, method)
    }
}

export function deleteRun<T extends Model>(
    method: (payload: Payload<T, Method.DELETE>) => Promise<boolean>,
) {
    return async function (this: typeof Model, query: QueryType<T>, options: Options = {}) {
        const payload = createPayload({
            method: Method.DELETE,
            query,
            options,
            model: this as unknown as ConstructorOf<T>,
            body: {},
        })
        return runLifecycle(payload, method)
    }
}
