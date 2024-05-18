import * as moment from "moment"
import { Model, ModelType, QueryType } from "../model/model"
import { SchemaType } from "../schema"
import { Options } from "../option"
import { State } from "../state"
import pre_rule from "./lifecycles/pre-rule"
import modify from "./lifecycles/modify"
import role from "./lifecycles/role"
import rule from "./lifecycles/rule"
import effect from "./lifecycles/effect"
import { Payload } from "../payload"
import * as lodash from "lodash"
import filter from "./lifecycles/filter"
import { FookieError } from "../error"
import { plainToClass } from "class-transformer"

function createPayload<T extends typeof Model, R>(
    payload: Omit<Payload<T, R>, "state" | "response">,
): Payload<T, R> {
    return {
        ...payload,
        response: null,
        options: payload.options ?? {},
        body: payload.body ?? {},
        query: payload.query ?? {},
        state: {
            metrics: {
                start: moment.utc().toDate(),
                end: null,
                lifecycle: [],
            },
            todo: [],
        },
    }
}

function finalizeState(state: State) {
    state.metrics.end = moment.utc().toDate()
}

async function runLifecycle<T extends typeof Model, R>(payload: Payload<T, R>) {
    if (await pre_rule(payload)) {
        await modify(payload)

        if (await role(payload)) {
            if (await rule(payload)) {
                if (payload.options?.test !== true && lodash.isNil(payload.response)) {
                    payload.response = await payload.methodFunction(payload)
                }
                await filter(payload)
                await effect(payload)
                finalizeState(payload.state)
                return plainToClass(payload.modelClass, payload.response)
            }
        }
    }

    return payload.error
}

export function createRun<T extends typeof Model>(
    model: ModelType,
    schema: SchemaType<T>,
    modelClass: T,
    methodFunction: (payload: Payload<T, T>) => Promise<T>,
) {
    return async function (body: InstanceType<T>, options: Options) {
        const payload: Payload<T, T> = createPayload({
            method: "create",
            model: model,
            schema: schema,
            body: body,
            options: options,
            methodFunction,
            error: FookieError.new({
                key: "",
                description: "",
                validationErrors: {},
            }),
            modelClass: modelClass,
            query: {},
        })
        return runLifecycle(payload)
    }
}

export function readRun<T extends typeof Model>(
    model: ModelType,
    schema: SchemaType<T>,
    modelClass: T,
    methodFunction: (payload: Payload<T, T[]>) => Promise<T[]>,
) {
    return async function (query: QueryType<T>, options: Options) {
        const payload: Payload<T, T[]> = createPayload({
            method: "read",
            model: model,
            schema: schema,
            query: query,
            options: options,
            methodFunction,
            error: FookieError.new({
                key: "",
                description: "",
                validationErrors: {},
            }),
            modelClass: modelClass,
            body: {},
        })
        return runLifecycle(payload)
    }
}

export function updateRun<T extends typeof Model>(
    model: ModelType,
    schema: SchemaType<T>,
    modelClass: T,

    methodFunction: (payload: Payload<T, boolean>) => Promise<boolean>,
) {
    return async function (query: QueryType<T>, body: Partial<InstanceType<T>>, options: Options) {
        const payload: Payload<T, boolean> = createPayload({
            method: "update",
            model: model,
            schema: schema,
            query: query,
            body: body,
            options: options,
            methodFunction,
            error: FookieError.new({
                key: "",
                description: "",
                validationErrors: {},
            }),
            modelClass: modelClass,
        })
        return runLifecycle(payload)
    }
}

export function deleteRun<T extends typeof Model>(
    model: ModelType,
    schema: SchemaType<T>,
    modelClass: T,
    methodFunction: (payload: Payload<T, boolean>) => Promise<boolean>,
) {
    return async function (query: QueryType<T>, options: Options) {
        const payload: Payload<T, boolean> = createPayload({
            method: "delete",
            model: model,
            schema: schema,
            query: query,
            options: options,
            methodFunction,
            error: FookieError.new({
                key: "",
                description: "",
                validationErrors: {},
            }),
            modelClass: modelClass,
            body: {},
        })
        return runLifecycle(payload)
    }
}

export function countRun<T extends typeof Model>(
    model: ModelType,
    schema: SchemaType<T>,
    modelClass: T,

    methodFunction: (payload: Payload<T, number>) => Promise<number>,
) {
    return async function (query: QueryType<T>, options: Options) {
        const payload: Payload<T, number> = createPayload({
            method: "count",
            model: model,
            schema: schema,
            query: query,
            options: options,
            methodFunction,
            error: FookieError.new({
                key: "",
                description: "",
                validationErrors: {},
            }),
            modelClass: modelClass,
            body: {},
        })
        return runLifecycle(payload)
    }
}

export function sumRun<T extends typeof Model>(
    model: ModelType,
    schema: SchemaType<T>,
    modelClass: T,
    methodFunction: (payload: Payload<T, number>) => Promise<number>,
) {
    return async function (query: QueryType<T>, fieldName: string, options: Options) {
        const payload: Payload<T, number> = createPayload({
            method: "sum",
            model: model,
            schema: schema,
            query: query,
            options: options,
            methodFunction,
            fieldName: fieldName,
            error: FookieError.new({
                key: "",
                description: "",
                validationErrors: {},
            }),
            modelClass: modelClass,
            body: {},
        })

        return runLifecycle(payload)
    }
}
