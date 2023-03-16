import * as lodash from "lodash"
console.log("filan") // TODO:

import type { ModelInterface, DatabaseInterface, Type, LifecycleFunction, MixinInterface } from "../declerations"

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
    temp = deepmerge(temp)
    for (const mixin of temp.mixins) {
        temp = deepmerge(temp, mixin)
    }
    temp = deepmerge(temp)

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
