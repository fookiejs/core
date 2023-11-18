import * as lodash from "lodash"
import pre_rule from "../lifecycles/pre_rule"
import modify from "../lifecycles/modify"
import role from "../lifecycles/role"
import rule from "../lifecycles/rule"
import { ModelInterface, LifecycleFunction, MixinInterface, PayloadInterface, Method, TypeInterface } from "../../../../types"
import { run } from "../../../run"
import * as Methods from "../../../method"
import * as fs from "fs"
import * as path from "path"
import { create_response } from "../lifecycles/flow"
import * as Lifecycle from "../../../lifecycle"

const lifecycles = ["pre_rule", "modify", "role", "rule", "filter", "effect"]

export function initialize_model_schema(model: Partial<ModelInterface>): void {
    const schemaKeys = lodash.keys(model.schema)

    for (const key of schemaKeys) {
        const field = model.schema[key]

        if (!lodash.has(field, "read")) {
            field.read = []
        }
    }
}

export function initialize_model_bindings(model: Partial<ModelInterface> | MixinInterface): void {
    for (const method of lodash.values(Methods) as string[]) {
        if (!lodash.isObject(model.bind[method])) {
            model.bind[method] = { role: [Lifecycle.system] }
        }
        for (const lifecycle of lifecycles) {
            if (!lodash.isArray(model.bind[method][lifecycle])) {
                model.bind[method][lifecycle] = []
            }
        }
    }
}

export function create_test_function(): LifecycleFunction<unknown, Method> {
    return async function (_payload: PayloadInterface<unknown, "test">) {
        const p = Object.assign(lodash.omit(_payload, ["response"]))
        p.method = _payload.options.method
        const s = {
            metrics: {
                start: Date.now(),
                lifecycle: [],
            },
            todo: [],
        }
        p.response = create_response(_payload.method)

        if (await pre_rule(p, s)) {
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

export function create_sumby_function(): LifecycleFunction<unknown, Method> {
    return async function (_payload) {
        const token = _payload.token || ""
        const response = await run({
            token: token,
            model: _payload.model,
            method: Methods.Read,
            query: _payload.query,
        })
        const total = lodash.sumBy(response.data as Array<any>, _payload.options.field)
        _payload.response.data = total
    }
}

export function generate_typescript_types(model: ModelInterface) {
    send_as_file(
        `${to_pascal_case(model.name)}.types.ts`,
        `
${generate_body_type(model)}\n
${generate_query_type(model)}\n
${generate_entity_type(model)}\n
${generate_update_body_type(model)}\n
        `
    )
}

export function get_typescript_type(type: TypeInterface): string {
    return type.native
}

function to_pascal_case(str: string) {
    return str
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")
}

function get_typescript_query_type(type: TypeInterface) {
    if (type.query) {
        return JSON.stringify(type.query).replaceAll(`"`, "")
    } else {
        return "unknown"
    }
}

function send_as_file(file: string, code: string) {
    const dir_path = path.join(`${process.env.FOOKIE_PATH || ""}`, ".fookie")
    if (!fs.existsSync(dir_path)) {
        fs.mkdirSync(dir_path, { recursive: true })
    }
    fs.writeFileSync(path.join(dir_path, file), code)
    return true
}

function generate_body_type(model: ModelInterface): string {
    let ts_type = `export interface ${to_pascal_case(model.name)}CreateBody {\n`

    for (const key in model.schema) {
        const tsType = get_typescript_type(model.schema[key].type)
        const field_name = model.schema[key].required ? key : key + "?"
        ts_type += `  ${field_name}: ${tsType}\n`
    }

    ts_type += `}`
    return ts_type
}

function generate_entity_type(model: ModelInterface): string {
    let ts_type = `export interface ${to_pascal_case(model.name)}Entity {\n`
    ts_type += `  ${model.database.pk}: ${get_typescript_type(model.database.pk_type)}\n`
    for (const key in model.schema) {
        const tsType = get_typescript_type(model.schema[key].type)
        const field_name = model.schema[key].required ? key : key + "?"
        ts_type += `  ${field_name}: ${tsType}\n`
    }

    ts_type += `}`
    return ts_type
}

function generate_update_body_type(model: ModelInterface): string {
    let ts_type = `export interface ${to_pascal_case(model.name)}UpdateBody {\n`

    for (const key in model.schema) {
        const tsType = get_typescript_type(model.schema[key].type)
        ts_type += `  ${key}?: ${tsType}\n`
    }

    ts_type += `}\n`
    return ts_type
}

function generate_query_type(model: ModelInterface): string {
    let ts_query_type = `export interface ${to_pascal_case(model.name)}Query {
    offset?: number
    limit?: number
    filter?: {
        \n`
    ts_query_type += `  ${model.database.pk}?: ${get_typescript_query_type(model.database.pk_type)}\n`
    for (const key in model.schema) {
        const filterType = get_typescript_query_type(model.schema[key].type)
        ts_query_type += `  ${key}?: ${filterType}\n`
    }
    ts_query_type += `
        }
    }
    `
    return ts_query_type
}
