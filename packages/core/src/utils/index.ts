import * as lodash from "lodash"
import pre_rule from "../../src/lifecycles/pre_rule"
import modify from "../../src/lifecycles/modify"
import role from "../../src/lifecycles/role"
import rule from "../../src/lifecycles/rule"

import { ModelInterface, LifecycleFunction, MixinInterface } from "../../../../types"
import { run } from "../.."
import { Methods, Read } from "../../../method"
import { system } from "../../../role"
import * as Type from "../../../type"

import * as fs from "fs"
import * as path from "path"

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
    for (const method of Methods) {
        if (!lodash.isObject(model.bind[method])) {
            model.bind[method] = { role: [system] }
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
            data: null,
            status: false,
            error: null,
        }

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

export function create_sumby_function(): LifecycleFunction {
    return async function (_payload) {
        const token = _payload.token || ""
        const response = await run({
            token: token,
            model: _payload.model,
            method: Read,
            query: _payload.query,
        })
        const total = lodash.sumBy(response.data, _payload.options.field)
        _payload.response.data = total
    }
}

export function generate_typescript_types(model: ModelInterface) {
    send_as_file(
        `interfaces/${to_pascal_case(model.name)}`,
        `${to_pascal_case(model.name)}.types.ts`,
        `
${generate_body_type(model)}\n
${generate_query_type(model)}\n
${generate_entity_type(model)}\n
${generate_update_body_type(model)}\n
        `
    )

    send_as_file(
        `repositories/${to_pascal_case(model.name)}`,
        `${to_pascal_case(model.name)}.repository.ts`,
        generate_repository(model)
    )
}

export function get_typescript_type_from_validator(validator: any): string {
    switch (validator) {
        case Type.Text:
        case Type.Char:
            return "string"
        case Type.Float:
        case Type.Integer:
        case Type.Timestamp:
            return "number"
        case Type.Boolean:
            return "boolean"
        case Type.Buffer:
            return "Buffer"
        case Type.Plain:
            return "object"
        case Type.Function:
            return "Function"
        case Type.DateType:
        case Type.Time:
        case Type.DateTime:
            return "string"
        default:
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
    switch (validator) {
        case Type.Text:
        case Type.Char:
            return "{ eq?: string, not?: string, contains?: string, in?: string[], out?: string[] }"
        case Type.Float:
        case Type.Integer:
        case Type.Timestamp:
            return "{ eq?: number, not?: number, gte?: number, lte?: number, gt?: number, lt?: number, in?: number[], out?: number[] }"
        case Type.Boolean:
            return "{ eq?: boolean, not?: boolean }"
        case Type.Buffer:
        case Type.Function:
            return "{}"
        case Type.DateType:
        case Type.Time:
        case Type.DateTime:
            return "{ eq?: Date, not?: Date, before?: Date, after?: Date, in?: Date[] }"
        case Type.Plain:
            return "{}"
        default:
            if (validator.array_type) {
                const array_type = get_typescript_type_from_validator(validator.array_type)
                return `{ includes?: ${array_type}, excludes?: ${array_type} }`
            }
            return "unknown"
    }
}

function send_as_file(folder: string, file: string, code: string) {
    const dirPath = path.join(".fookie", folder)
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
    fs.writeFileSync(path.join(dirPath, file), code)
    return true
}

function generate_body_type(model: ModelInterface): string {
    let ts_type = `export interface ${to_pascal_case(model.name)}CreateBody {\n`

    for (const key in model.schema) {
        let tsType = get_typescript_type_from_validator(model.schema[key].type)
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
        let tsType = get_typescript_type_from_validator(model.schema[key].type)
        const field_name = model.schema[key].required ? key : key + "?"
        ts_type += `  ${field_name}: ${tsType}\n`
    }

    ts_type += `}`
    return ts_type
}

function generate_update_body_type(model: ModelInterface): string {
    let ts_type = `export interface ${to_pascal_case(model.name)}UpdateBody {\n`

    for (const key in model.schema) {
        let tsType = get_typescript_type_from_validator(model.schema[key].type)
        ts_type += `  ${key}?: ${tsType}\n`
    }

    ts_type += `}\n`
    return ts_type
}

function generate_query_type(model: ModelInterface): string {
    let ts_query_type = `export interface ${to_pascal_case(model.name)}Query {\n`
    ts_query_type += `  ${model.database.pk}: ${get_typescript_query_type(model.database.pk_type)}\n`
    for (const key in model.schema) {
        const filterType = get_typescript_query_type(model.schema[key].type)
        ts_query_type += `  ${key}?: ${filterType}\n`
    }
    ts_query_type += `}`
    return ts_query_type
}

function generate_repository(model: ModelInterface): string {
    return `
    
    import { Core, Method, Types } from "${process.env.FOOKIE_TEST == "true" ? "../../../index" : "fookie"}"
    import { ${to_pascal_case(model.name)}Body } from "../../interfaces/${to_pascal_case(model.name)}/${to_pascal_case(
        model.name
    )}.type"

    import { ${to_pascal_case(model.name)}Query } from "../../interfaces/${to_pascal_case(model.name)}/${to_pascal_case(
        model.name
    )}.query"

    type ModifiedPayload = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'query' | 'body'> & {
        query:{
            filter:${to_pascal_case(model.name)}Query
            body: ${to_pascal_case(model.name)}Body
        };
    }

    export async function Create(payload:ModifiedPayload): Promise<${to_pascal_case(model.name)}Body> {
        const response = await Core.run({ model:Core.Model.${to_pascal_case(model.name)}, method:Method.Create, ...payload })
        return response.data
    }
    export async function Read(payload:ModifiedPayload): Promise<${to_pascal_case(model.name)}Body[]> {
        const response = await Core.run({ model:Core.Model.${to_pascal_case(model.name)}, method:Method.Read, ...payload })
        return response.data
    }
    export async function Update(payload:ModifiedPayload): Promise<Boolean> {
        const response = await Core.run({ model:Core.Model.${to_pascal_case(model.name)}, method:Method.Update, ...payload })
        return response.data
    }
    export async function Delete(payload:ModifiedPayload): Promise<Boolean> {
        const response = await Core.run({ model:Core.Model.${to_pascal_case(model.name)}, method:Method.Delete, ...payload })
        return response.data
    }
    export async function Sum(payload:ModifiedPayload): Promise<Number> {
        const response = await Core.run({ model:Core.Model.${to_pascal_case(model.name)}, method:Method.Sum, ...payload })
        return response.data
    }
    export async function Count(payload:ModifiedPayload):Promise<Number> {
        const response = await Core.run({ model:Core.Model.${to_pascal_case(model.name)}, method:Method.Count, ...payload })
        return response.data
    }
    export async function Test(payload:ModifiedPayload): Promise<Types.ResponseInterface> {
        const response = await Core.run({ model:Core.Model.${to_pascal_case(model.name)}, method:Method.Test, ...payload })
        return response.data
    }

    `
}
