import * as lodash from "lodash"
import pre_rule from "../lifecycles/pre_rule"
import modify from "../lifecycles/modify"
import role from "../lifecycles/role"
import rule from "../lifecycles/rule"

import { ModelInterface, LifecycleFunction, MixinInterface, PayloadInterface } from "../../../../types"
import { run } from "../../../run"
import * as Method from "../../../method"
import * as Role from "../../../role"
import * as Type from "../../../type"

import * as fs from "fs"
import * as path from "path"
import { create_response } from "../lifecycles/flow"

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
    for (const method of lodash.values(Method) as string[]) {
        if (!lodash.isObject(model.bind[method])) {
            model.bind[method] = { role: [Role.system] }
        }
        for (const lifecycle of lifecycles) {
            if (!lodash.isArray(model.bind[method][lifecycle])) {
                model.bind[method][lifecycle] = []
            }
        }
    }
}

export function create_test_function(): LifecycleFunction {
    return async function (_payload: PayloadInterface) {
        const p = Object.assign(lodash.omit(_payload, ["response"]))
        p.method = _payload.options.method
        const s = {
            metrics: {
                start: Date.now(),
                lifecycle: [],
            },
            todo: [],
        }
        p.response = create_response()

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
            method: Method.Read,
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

function generate_repository(model: ModelInterface): string {
    return `
    
    import { run, Model, Method, Types } from "${process.env.FOOKIE_TEST == "true" ? "../../../index" : "fookie"}"
    import { 
        ${to_pascal_case(model.name)}CreateBody, 
        ${to_pascal_case(model.name)}UpdateBody,
        ${to_pascal_case(model.name)}Entity,
        ${to_pascal_case(model.name)}Query 
    } from "../../interfaces/${to_pascal_case(model.name)}/${to_pascal_case(model.name)}.types"

    type CreatePayload = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'query' | 'body'> & {
        body: ${to_pascal_case(model.name)}CreateBody
    }
    type ReadPayload = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'query' | 'body'> & {
        query:${to_pascal_case(model.name)}Query
    }
    type UpdatePayload = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'query' | 'body'> & {
        query:${to_pascal_case(model.name)}Query
        body:${to_pascal_case(model.name)}UpdateBody
    }

    type CreateResponse = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'data'> & {
       data:${to_pascal_case(model.name)}Entity
    }

    type ReadResponse = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'data'> & {
        data:${to_pascal_case(model.name)}Entity[]

     }

     type UpdateResponse = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'data'> & {
        data:boolean
     }

     type DeleteResponse = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'data'> & {
        data:boolean
     }

     type CountResponse = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'data'> & {
        data:number
     }

     type SumResponse = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'data'> & {
        data:number
     }

     type TestResponse = Omit<Types.PayloadInterfaceWithoutModelAndMethod, 'data'> & {
        data:Types.ResponseInterface
     }

    export async function Create(payload:CreatePayload): Promise<CreateResponse> {
        const response = await run({ model:Model["${model.name}"], method:Method.Create, ...payload })
        return response
    }
    export async function Read(payload:ReadPayload): Promise<ReadResponse> {
        const response = await run({ model:Model["${model.name}"], method:Method.Read, ...payload })
        return response
    }
    export async function Update(payload:UpdatePayload): Promise<UpdateResponse> {
        const response = await run({ model:Model["${model.name}"], method:Method.Update, ...payload })
        return response
    }
    export async function Delete(payload:ReadPayload): Promise<DeleteResponse> {
        const response = await run({ model:Model["${model.name}"], method:Method.Delete, ...payload })
        return response
    }
    export async function Sum(payload:ReadPayload): Promise<SumResponse> {
        const response = await run({ model:Model["${model.name}"], method:Method.Sum, ...payload })
        return response
    }
    export async function Count(payload:ReadPayload):Promise<CountResponse> {
        const response = await run({ model:Model["${model.name}"], method:Method.Count, ...payload })
        return response
    }
    export async function Test(payload:UpdatePayload): Promise<TestResponse> {
        const response = await run({ model:Model["${model.name}"], method:Method.Test, ...payload })
        return response
    }

    `
}
