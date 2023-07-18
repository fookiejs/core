import * as lodash from "lodash"
import preRule from "./src/lifecycles/preRule"
import modify from "./src/lifecycles/modify"
import role from "./src/lifecycles/role"
import rule from "./src/lifecycles/rule"
import method from "./src/lifecycles/method"
import filter from "./src/lifecycles/filter"
import effect from "./src/lifecycles/effect"
import { v4 } from "uuid"
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
import {
    create_sumby_function,
    create_test_function,
    get_model_name,
    initialize_model_bindings,
    initialize_model_schema,
} from "./src/utils"

if (!process.env.SYSTEM_TOKEN) {
    process.env.SYSTEM_TOKEN = v4()
}

export const models: ModelInterface[] = []

export async function model(model: Partial<ModelInterface>): Promise<ModelInterface> {
    model.mixins = lodash.isArray(model.mixins) ? model.mixins : []
    model.bind = lodash.isObject(model.bind) ? model.bind : {}

    initialize_model_schema(models, model)
    initialize_model_bindings(model)
    const schema_keys = lodash.keys(model.schema)
    for (const key of schema_keys) {
        if (model.schema[key].relation) {
            model.schema[key].type = model.schema[key].relation.database.pk_type
        }
    }
    let temp: Partial<ModelInterface> = Object.assign(model)

    for (const mixin of temp.mixins) {
        temp = deepmerge(temp, mixin)
    }

    Object.assign(model, temp)

    await model.database.modify(model)
    model.methods.test = create_test_function()
    model.methods.sum = create_sumby_function()

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
        | (Omit<PayloadInterface, "model"> & { model: string }),
    state?: StateInterface
) {
    const model_name = get_model_name(payload.model)
    const model = models.find((model) => model.name === model_name)

    return await _run(
        { model, ...lodash.omit(payload, "model") },
        {
            ...state,
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
