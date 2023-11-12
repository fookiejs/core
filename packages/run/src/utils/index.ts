import * as lodash from "lodash"
import pre_rule from "../lifecycles/pre_rule"
import modify from "../lifecycles/modify"
import role from "../lifecycles/role"
import rule from "../lifecycles/rule"

import { ModelInterface, LifecycleFunction, MixinInterface, PayloadInterface, Method } from "../../../../types"
import { run } from "../../../run"
import * as Methods from "../../../method"
import * as Type from "../../../type"

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

export function get_typescript_type_from_validator(validator: any): string {
    if (validator === Type.Text || validator === Type.Char) {
        return "string"
    } else if (validator === Type.Float || validator === Type.Integer || validator === Type.Timestamp) {
        return "number"
    } else if (validator === Type.Boolean) {
        return "boolean"
    } else if (validator === Type.Buffer) {
        return "Buffer"
    } else if (validator === Type.Plain) {
        return "object"
    } else if (validator === Type.Function) {
        return "Function"
    } else if (validator === Type.DateType || validator === Type.Time || validator === Type.DateTime) {
        return "string"
    } else {
        if (validator.array_type) {
            const array_type = get_typescript_type_from_validator(validator.array_type)
            return `Array<${array_type}>`
        }
        return "unknown"
    }
}

function to_pascal_case(str: string) {
    return str
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")
}

function get_typescript_query_type(validator: any) {
    if (validator === Type.Text || validator === Type.Char) {
        return "{ eq?: string, not?: string, contains?: string, in?: string[], out?: string[] }"
    } else if (validator === Type.Float || validator === Type.Integer || validator === Type.Timestamp) {
        return "{ eq?: number, not?: number, gte?: number, lte?: number, gt?: number, lt?: number, in?: number[], out?: number[] }"
    } else if (validator === Type.Boolean) {
        return "{ eq?: boolean, not?: boolean }"
    } else if (validator === Type.Buffer || validator === Type.Function) {
        return "{}"
    } else if (validator === Type.DateType || validator === Type.Time || validator === Type.DateTime) {
        return "{ eq?: Date, not?: Date, before?: Date, after?: Date, in?: Date[] }"
    } else if (validator === Type.Plain) {
        return "{}"
    } else {
        if (validator.array_type) {
            const array_type = get_typescript_type_from_validator(validator.array_type)
            return `{ includes?: ${array_type}, excludes?: ${array_type} }`
        }
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
        const tsType = get_typescript_type_from_validator(model.schema[key].type)
        const field_name = model.schema[key].required ? key : key + "?"
        ts_type += `  ${field_name}: ${tsType}\n`
    }

    ts_type += `}`
    return ts_type
}

function generate_entity_type(model: ModelInterface): string {
    let ts_type = `export interface ${to_pascal_case(model.name)}Entity {\n`
    ts_type += `  ${model.database.pk}: ${get_typescript_type_from_validator(model.database.pk_type)}\n`
    for (const key in model.schema) {
        const tsType = get_typescript_type_from_validator(model.schema[key].type)
        const field_name = model.schema[key].required ? key : key + "?"
        ts_type += `  ${field_name}: ${tsType}\n`
    }

    ts_type += `}`
    return ts_type
}

function generate_update_body_type(model: ModelInterface): string {
    let ts_type = `export interface ${to_pascal_case(model.name)}UpdateBody {\n`

    for (const key in model.schema) {
        const tsType = get_typescript_type_from_validator(model.schema[key].type)
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
    ts_query_type += `  ${model.database.pk}: ${get_typescript_query_type(model.database.pk_type)}\n`
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
