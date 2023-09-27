import * as lodash from "lodash"
import { v4 } from "uuid"
import {
    TypeInterface,
    ModelInterface,
    LifecycleFunction,
    MixinInterface,
    DatabaseInterface,
    SelectionInterface,
} from "../../types"
import deepmerge = require("deepmerge")
import {
    create_sumby_function,
    create_test_function,
    generate_typescript_types,
    initialize_model_bindings,
    initialize_model_schema,
} from "../run/src/utils"
import * as Dictionary from "../dictionary"

if (!process.env.SYSTEM_TOKEN) {
    process.env.SYSTEM_TOKEN = v4()
}

export async function model(model: Partial<ModelInterface>): Promise<ModelInterface> {
    model.mixins = lodash.isArray(model.mixins) ? model.mixins : []
    model.bind = lodash.isObject(model.bind) ? model.bind : {}

    initialize_model_schema(model)
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

    Dictionary.Model[model.name] = model as ModelInterface

    if (process.env.FOOKIE_DEV === "true") {
        generate_typescript_types(model as ModelInterface)
    }

    return model as ModelInterface
}

export const lifecycle = function (lifecycle: LifecycleFunction) {
    return lifecycle
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

export function type(type: TypeInterface) {
    return type
}

export function role(role: LifecycleFunction) {
    return role
}

export function selection(selection: SelectionInterface) {
    return selection
}
