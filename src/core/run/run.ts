import * as moment from "moment"
import { Model, QueryType } from "../model/model"
import { Options } from "../option"
import pre_rule from "./lifecycles/pre-rule"
import modify from "./lifecycles/modify"
import role from "./lifecycles/role"
import rule from "./lifecycles/rule"
import effect from "./lifecycles/effect"
import { Payload } from "../payload"
import filter from "./lifecycles/filter"
import { FookieError } from "../error"
import { plainToInstance } from "class-transformer"
import { Method } from "../method"
import globalEffect from "./lifecycles/global_effect"

function createPayload<model extends Model>(
    payload: Omit<Payload<model>, "state" | "response">,
): Payload<model> {
    return {
        ...payload,
        options: payload.options ?? {},
        body: payload.body ?? {},
        query: payload.query ?? {},
        state: {
            metrics: {
                start: moment.utc().toDate(),
                end: moment.utc().toDate(),
                lifecycle: [],
            },
            todo: [],
        },
    }
}

async function runLifecycle<model extends Model>(payload: Payload<model>, method: Function) {
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

export function createRun<model extends Model>(method: Function) {
    return async function (this: typeof Model, body: model, options: Options) {
        const payload: Payload<model> = createPayload({
            method: Method.CREATE,
            body: body,
            options: options,
            model: this,
            query: {} as QueryType<model>,
            fieldName: "",
        })
        return runLifecycle(payload, method)
    }
}

export function readRun<model extends Model>(method: Function) {
    return async function (this: typeof Model, query: QueryType<model>, options: Options) {
        const payload: Payload<model> = createPayload({
            method: Method.READ,
            query: query,
            options: options,
            model: this,
            body: {} as model,
            fieldName: "",
        })
        return runLifecycle(payload, method)
    }
}

export function updateRun<model extends Model>(method: Function) {
    return async function (
        this: typeof Model,
        query: QueryType<model>,
        body: Partial<model>,
        options: Options,
    ) {
        const payload: Payload<model> = createPayload({
            method: Method.UPDATE,
            query: query,
            body: body as model,
            options: options,
            model: this,
            fieldName: "",
        })
        return runLifecycle(payload, method)
    }
}

export function deleteRun<model extends Model>(method: Function) {
    return async function (this: typeof Model, query: QueryType<model>, options: Options) {
        const payload: Payload<model> = createPayload({
            method: Method.DELETE,
            query: query,
            options: options,
            model: this,
            body: {} as model,
            fieldName: "",
        })
        return runLifecycle(payload, method)
    }
}

export function countRun<model extends Model>(method: Function) {
    return async function (this: typeof Model, query: QueryType<model>, options: Options) {
        const payload: Payload<model> = createPayload({
            method: Method.COUNT,
            query: query,
            options: options,
            model: this,
            body: {} as model,
            fieldName: "",
        })
        return runLifecycle(payload, method)
    }
}

export function sumRun<model extends Model>(method: Function) {
    return async function (
        this: typeof Model,
        query: QueryType<model>,
        fieldName: string,
        options: Options,
    ) {
        const payload: Payload<model> = createPayload({
            method: Method.SUM,
            query: query,
            options: options,
            fieldName: fieldName,
            model: this,
            body: {} as model,
        })

        return runLifecycle(payload, method)
    }
}
