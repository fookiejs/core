import * as moment from "moment"
import { Model, ModelTypeOutput, QueryType } from "../model/model"
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
import { plainToInstance } from "class-transformer"

function createPayload<ModelClass extends Model, R>(
    payload: Omit<Payload<ModelClass, R>, "state" | "response">,
): Payload<ModelClass, R> {
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

async function runLifecycle<ModelClass extends Model, ResponseType>(
    payload: Payload<ModelClass, ResponseType>,
) {
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
                return plainToInstance(payload.modelClass, payload.response)
            }
        }
    }

    return payload.error
}

export function createRun<ModelClass extends Model>(
    model: Required<ModelTypeOutput>,
    schema: SchemaType<ModelClass>,
    methodFunction: (payload: Payload<ModelClass, ModelClass>) => Promise<ModelClass>,
) {
    return async function (this: typeof Model, body: ModelClass, options: Options) {
        const payload: Payload<ModelClass, ModelClass> = createPayload({
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
            modelClass: this,
            query: {} as QueryType<ModelClass>,
            fieldName: "",
        })
        return runLifecycle(payload)
    }
}

export function readRun<ModelClass extends Model>(
    model: Required<ModelTypeOutput>,
    schema: SchemaType<ModelClass>,

    methodFunction: (payload: Payload<ModelClass, ModelClass[]>) => Promise<ModelClass[]>,
) {
    return async function (this: typeof Model, query: QueryType<ModelClass>, options: Options) {
        const payload: Payload<ModelClass, ModelClass[]> = createPayload({
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
            modelClass: this,
            body: {} as ModelClass,
            fieldName: "",
        })
        return runLifecycle(payload)
    }
}

export function updateRun<ModelClass extends Model>(
    model: Required<ModelTypeOutput>,
    schema: SchemaType<ModelClass>,
    methodFunction: (payload: Payload<ModelClass, boolean>) => Promise<boolean>,
) {
    return async function (
        this: typeof Model,
        query: QueryType<ModelClass>,
        body: Partial<ModelClass>,
        options: Options,
    ) {
        const payload: Payload<ModelClass, boolean> = createPayload({
            method: "update",
            model: model,
            schema: schema,
            query: query,
            body: body as ModelClass,
            options: options,
            methodFunction,
            error: FookieError.new({
                key: "",
                description: "",
                validationErrors: {},
            }),
            modelClass: this,
            fieldName: "",
        })
        return runLifecycle(payload)
    }
}

export function deleteRun<ModelClass extends Model>(
    model: Required<ModelTypeOutput>,
    schema: SchemaType<ModelClass>,
    methodFunction: (payload: Payload<ModelClass, boolean>) => Promise<boolean>,
) {
    return async function (this: typeof Model, query: QueryType<ModelClass>, options: Options) {
        const payload: Payload<ModelClass, boolean> = createPayload({
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
            modelClass: this,
            body: {} as ModelClass,
            fieldName: "",
        })
        return runLifecycle(payload)
    }
}

export function countRun<ModelClass extends Model>(
    model: Required<ModelTypeOutput>,
    schema: SchemaType<ModelClass>,
    methodFunction: (payload: Payload<ModelClass, number>) => Promise<number>,
) {
    return async function (this: typeof Model, query: QueryType<ModelClass>, options: Options) {
        const payload: Payload<ModelClass, number> = createPayload({
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
            modelClass: this,
            body: {} as ModelClass,
            fieldName: "",
        })
        return runLifecycle(payload)
    }
}

export function sumRun<ModelClass extends Model>(
    model: Required<ModelTypeOutput>,
    schema: SchemaType<ModelClass>,
    methodFunction: (payload: Payload<ModelClass, number>) => Promise<number>,
) {
    return async function (
        this: typeof Model,
        query: QueryType<ModelClass>,
        fieldName: string,
        options: Options,
    ) {
        const payload: Payload<ModelClass, number> = createPayload({
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
            modelClass: this,
            body: {} as ModelClass,
        })

        return runLifecycle(payload)
    }
}
