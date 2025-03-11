import { Options } from "../option"
import { Payload, ConstructorOf } from "../payload"
import * as moment from "moment"
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

function createPayload<T extends Model, M extends Method>(
    payload: Omit<Payload<T, M>, "runId" | "state">,
): Payload<T, M> {
    return {
        ...payload,
        runId: "abc",
        state: {
            metrics: {
                start: moment.utc().toDate(),
                end: moment.utc().toDate(),
                lifecycle: [],
            },
        },
    }
}

async function runLifecycle<T extends Model, M extends Method>(
    payload: Payload<T, M>,
    method: (payload: Payload<T, M>, error: FookieError) => Promise<any>,
) {
    const error = FookieError.new({
        description: "run",
        validationErrors: {},
        key: "run",
    })

    if (!(await pre_rule(payload, error))) {
        return error
    }

    await modify(payload)

    if (!(await role(payload, error))) {
        return error
    }

    if (!(await rule(payload, error))) {
        return error
    }

    if (payload.options?.test === true) {
        await globalEffect(payload)
        return true
    }

    const response = plainToInstance(payload.model, await method(payload, error))

    await filter(payload, response)
    await effect(payload, response)
    await globalEffect(payload, response)

    return response
}

export function createRun<T extends Model>(
    method: (payload: Payload<T, Method.CREATE>, error: FookieError) => Promise<T>,
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
    method: (payload: Payload<T, Method.READ>, error: FookieError) => Promise<T[]>,
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
    method: (payload: Payload<T, Method.UPDATE>, error: FookieError) => Promise<boolean>,
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
    method: (payload: Payload<T, Method.DELETE>, error: FookieError) => Promise<boolean>,
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
