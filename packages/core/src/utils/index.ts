import * as lodash from "lodash"
import preRule from "../../src/lifecycles/preRule"
import modify from "../../src/lifecycles/modify"
import role from "../../src/lifecycles/role"
import rule from "../../src/lifecycles/rule"

import { ModelInterface, LifecycleFunction, MixinInterface } from "../../../../types"
import { run } from "../.."
import { Methods, Read } from "../../../method"

const lifecycles = ["preRule", "modify", "role", "rule", "filter", "effect"]

export function get_model_name(model: Function | string | ModelInterface): string {
    if (typeof model === "function") {
        return lodash.toLower(model.name)
    }
    return typeof model === "string" ? model : model.name
}

export function initialize_model_schema(models: ModelInterface[], model: Partial<ModelInterface>): void {
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

export function initialize_model_bindings(model: Partial<ModelInterface> | MixinInterface): void {
    for (const method of Methods) {
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

export function create_test_function(): LifecycleFunction {
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

export function create_sumby_function(): LifecycleFunction {
    return async function (_payload) {
        const response = await run({
            model: _payload.model,
            method: Read,
            query: _payload.query,
        })
        const total = lodash.sumBy(response.data, _payload.options.field)
        _payload.response.data = total
    }
}
