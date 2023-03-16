import * as lodash from "lodash"
import { After } from "./core/mixin/After"
import { Before } from "./core/mixin/Before"
const methods = ["create", "read", "update", "delete", "count", "test"]
const lifecycles = ["preRule", "modify", "role", "rule", "filter", "effect"]
const deepmerge = require("deepmerge")

export const models: ModelInterface[] = []

export function model(model: Partial<ModelInterface>): ModelInterface {
    if (!lodash.isArray(model.mixins)) {
        model.mixins = []
    }

    if (!lodash.isObject(model.bind)) {
        model.bind = {}
    }

    const schema_keys = lodash.keys(model.schema)

    for (const key of schema_keys) {
        if (!lodash.has(model.schema[key], "read")) {
            model.schema[key].read = []
        }
    }

    for (const method of methods) {
        if (!lodash.isObject(model.bind[method])) {
            model.bind[method] = {}
        }
        for (const lifecycle of lifecycles) {
            if (!lodash.isArray(model.bind[method][lifecycle])) {
                model.bind[method][lifecycle] = []
            }
        }
    }

    let temp: ModelInterface = Object.assign(model)
    temp = deepmerge(After, temp)
    for (const mixin of temp.mixins) {
        temp = deepmerge(temp, mixin)
    }
    temp = deepmerge(Before, temp)

    for (const key of lodash.keys(temp)) {
        model[key] = temp[key]
    }
    //@ts-ignore
    models.push(model)
    //@ts-ignore
    return model
}

export function database(database: DatabaseInterface) {
    return database
}

export function type(type: Type) {
    return type
}

export const lifecycle = function (lifecycle: LifecycleFunction) {
    return lifecycle
}

export function mixin(mixin: MixinInterface) {
    return mixin
}

export async function run(
    payload:
        | PayloadInterface
        | (Omit<PayloadInterface, "model"> & { model: Function })
        | (Omit<PayloadInterface, "model"> & { model: string }),
    state?: StateInterface
) {
    let model: ModelInterface
    if (typeof payload.model === "function") {
        const val = payload.model.name
        model = models.find((model) => model.name === val)
    } else if (typeof payload.model === "string") {
        const val = payload.model
        model = models.find((model) => model.name === val)
    }

    return await _run({ model, ...lodash.omit(payload, "model") }, state)
}

async function _run(payload: PayloadInterface, state?: StateInterface): Promise<any> {}
