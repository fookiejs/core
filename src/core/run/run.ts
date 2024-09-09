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

async function runLifecycle<ModelClass extends Model>(payload: Payload<ModelClass>,method:Function) {
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

    const response = plainToInstance(
        payload.modelClass,
        await method(payload, error),
    )

    await filter(payload, response)
    await effect(payload, response)
    await globalEffect(payload, response)

    return response
}

export function createRun<ModelClass extends Model>(method:Function) {
    return async function (this: typeof Model, body: ModelClass, options: Options) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.CREATE,
            body: body,
            options: options,
            modelClass: this,
            query: {} as QueryType<ModelClass>,
            fieldName: "",
        })
        return runLifecycle(payload,method)
    }
}

export function readRun<ModelClass extends Model>(method:Function) {
    return async function (this: typeof Model, query: QueryType<ModelClass>, options: Options) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.READ,
            query: query,
            options: options,
            modelClass: this,
            body: {} as ModelClass,
            fieldName: "",
        })
                return runLifecycle(payload,method)

    }
}

export function updateRun<ModelClass extends Model>(method:Function) {
    return async function (
        this: typeof Model,
        query: QueryType<ModelClass>,
        body: Partial<ModelClass>,
        options: Options,
    ) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.UPDATE,
            query: query,
            body: body as ModelClass,
            options: options,
            modelClass: this,
            fieldName: "",
        })
                return runLifecycle(payload,method)

    }
}

export function deleteRun<ModelClass extends Model>(method:Function) {
    return async function (this: typeof Model, query: QueryType<ModelClass>, options: Options) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.DELETE,
            query: query,
            options: options,
            modelClass: this,
            body: {} as ModelClass,
            fieldName: "",
        })
                return runLifecycle(payload,method)

    }
}

export function countRun<ModelClass extends Model>(method:Function) {
    return async function (this: typeof Model, query: QueryType<ModelClass>, options: Options) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.COUNT,
            query: query,
            options: options,
            modelClass: this,
            body: {} as ModelClass,
            fieldName: "",
        })
                return runLifecycle(payload,method)

    }
}

export function sumRun<ModelClass extends Model>(method:Function) {
    return async function (
        this: typeof Model,
        query: QueryType<ModelClass>,
        fieldName: string,
        options: Options,
    ) {
        const payload: Payload<ModelClass> = createPayload({
            method: Method.SUM,
            query: query,
            options: options,
            fieldName: fieldName,
            modelClass: this,
            body: {} as ModelClass,
        })

                return runLifecycle(payload,method)

    }
}
