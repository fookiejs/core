import * as lodash from "lodash"
import preRule from "./src/lifecycles/preRule"
import modify from "./src/lifecycles/modify"
import role from "./src/lifecycles/role"
import rule from "./src/lifecycles/rule"
import method from "./src/lifecycles/method"
import filter from "./src/lifecycles/filter"
import effect from "./src/lifecycles/effect"
import {
    Type,
    ModelInterface,
    LifecycleFunction,
    PayloadInterface,
    StateInterface,
    MixinInterface,
    DatabaseInterface,
} from "../../types"
import deepmerge = require("deepmerge")

const methods = ["create", "read", "update", "delete", "count", "test"]
const lifecycles = ["preRule", "modify", "role", "rule", "filter", "effect"]

export const models: ModelInterface[] = []

export function model(model: Partial<ModelInterface>): ModelInterface {
    model.mixins = lodash.isArray(model.mixins) ? model.mixins : []
    model.bind = lodash.isObject(model.bind) ? model.bind : {}

    initialize_model_schema(model)
    initialize_model_bindings(model)

    let temp: Partial<ModelInterface> = Object.assign(model)

    for (const mixin of temp.mixins) {
        temp = deepmerge(temp, mixin)
    }

    Object.assign(model, temp)

    model.database.modify(model)
    model.methods.test = create_test_function()

    models.push(model as ModelInterface)
    return model as ModelInterface
}

export const lifecycle = function (lifecycle: LifecycleFunction) {
    return lifecycle
}

export async function run(
    payload:
        | PayloadInterface
        | (Omit<PayloadInterface, "model"> & { model: Function })
        | (Omit<PayloadInterface, "model"> & { model: string })
) {
    const model_name = get_model_name(payload.model)
    const model = models.find((model) => model.name === model_name)

    return await _run(
        { model, ...lodash.omit(payload, "model") },
        {
            metrics: {
                start: Date.now(),
                lifecycle: [],
            },
            todo: [],
        }
    )
}

async function _run(payload: PayloadInterface, state: StateInterface): Promise<any> {
    payload.response = {
        data: undefined,
        status: false,
        error: null,
    }

    if (!(await preRule(payload, state))) {
        return payload.response
    }

    await modify(payload, state)

    if (!(await role(payload, state))) {
        return payload.response
    }

    if (!(await rule(payload, state))) {
        payload.response.data = undefined
        return payload.response
    }

    payload.response.status = true
    await method(payload, state)
    await filter(payload, state)
    await effect(payload, state)
    return lodash.assign({}, payload.response)
}

export function mixin(mixin: MixinInterface) {
    mixin.bind = lodash.isObject(mixin.bind) ? mixin.bind : {}
    mixin.schema = lodash.isObject(mixin.schema) ? mixin.schema : {}
    initialize_model_bindings(mixin)

    return mixin
}

export const database = function (database: DatabaseInterface) {
    return database
}

export function type(type: Type) {
    return type
}

function get_model_name(model: Function | string | ModelInterface): string {
    if (typeof model === "function") {
        return lodash.toLower(model.name)
    }
    return typeof model === "string" ? model : model.name
}

function initialize_model_schema(model: Partial<ModelInterface>): void {
    const schemaKeys = lodash.keys(model.schema)

    for (const key of schemaKeys) {
        const field = model.schema[key]

        if (!lodash.has(field, "read")) {
            field.read = []
        }

        if (lodash.has(field, "relation")) {
            if (typeof field.relation === "function") {
                const val = (field.relation as Function).name
                const relatedModel = lodash.find(models, { name: lodash.toLower(val) })
                field.relation = relatedModel
            }
        }
    }
}

function initialize_model_bindings(model: Partial<ModelInterface> | MixinInterface): void {
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
}

function create_test_function(): LifecycleFunction {
    return async function (_payload) {
        const p = Object.assign(lodash.omit(_payload, ["response"]))
        p.method = _payload.options.method
        const s = {
            metrics: {
                start: Date.now(),
                lifecycle: [],
            },
            todo: [],
        }
        p.response = {
            data: undefined,
            status: false,
            error: null,
        }

        if (await preRule(p, s)) {
            await modify(p, s)
            if (await role(p, s)) {
                if (await rule(p, s)) {
                    p.response.status = true
                }
            }
        }
        _payload.response.data = Object.assign(p.response)
    }
}
