import * as moment from "moment"
import { Model, ModelTypeOutput, QueryType } from "../model/model"
import { SchemaType } from "../schema"
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

function createPayload<ModelClass extends Model>(
    payload: Omit<Payload<ModelClass>, "state" | "response">,
): Payload<ModelClass> {
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

async function runLifecycle<ModelClass extends Model>(payload: Payload<ModelClass>) {
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
        endRun(payload)
        return true
    }

    const response = plainToInstance(
        payload.modelClass,
        await Reflect.getMetadata("methods", payload.modelClass)[payload.method](payload, error),
    )

    await filter(payload, response)
    await effect(payload, response)

    endRun(payload)
    return response
}

async function endRun(payload: Payload<any>, response?) {
    payload.state.metrics.end = moment.utc().toDate()
    await globalEffect(payload, response)
}

export function createRun<ModelClass extends Model>(
    model: Required<ModelTypeOutput>,
    schema: SchemaType<ModelClass>,
) {
    return async function (this: typeof Model, body: ModelClass, options: Options) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.CREATE,
            model: model,
            schema: schema,
            body: body,
            options: options,
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
) {
    return async function (this: typeof Model, query: QueryType<ModelClass>, options: Options) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.READ,
            model: model,
            schema: schema,
            query: query,
            options: options,
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
) {
    return async function (
        this: typeof Model,
        query: QueryType<ModelClass>,
        body: Partial<ModelClass>,
        options: Options,
    ) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.UPDATE,
            model: model,
            schema: schema,
            query: query,
            body: body as ModelClass,
            options: options,
            modelClass: this,
            fieldName: "",
        })
        return runLifecycle(payload)
    }
}

export function deleteRun<ModelClass extends Model>(
    model: Required<ModelTypeOutput>,
    schema: SchemaType<ModelClass>,
) {
    return async function (this: typeof Model, query: QueryType<ModelClass>, options: Options) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.DELETE,
            model: model,
            schema: schema,
            query: query,
            options: options,
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
) {
    return async function (this: typeof Model, query: QueryType<ModelClass>, options: Options) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.COUNT,
            model: model,
            schema: schema,
            query: query,
            options: options,
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
) {
    return async function (
        this: typeof Model,
        query: QueryType<ModelClass>,
        fieldName: string,
        options: Options,
    ) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.SUM,
            model: model,
            schema: schema,
            query: query,
            options: options,
            fieldName: fieldName,
            modelClass: this,
            body: {} as ModelClass,
        })

        return runLifecycle(payload)
    }
}
